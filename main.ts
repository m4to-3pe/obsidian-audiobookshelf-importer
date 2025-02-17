import {  request, Notice, Plugin, PluginSettingTab, Setting, App } from "obsidian";

interface ABSPluginSettings {
  host: string;
  apiKey: string;
  
  abDir: string;
  abEnable: boolean;
  abLib: string;
  abSortBy: string;
  abTemplate: string;

  ebDir: string;
  ebEnable: boolean;
  ebLib: string;
  ebSortBy: string;
  ebTemplate: string;

  podDir: string;
  podEnable: boolean;
  podLib: string;
  podSortBy: string;
  podTemplate: string;
}

const DEFAULT_SETTINGS: ABSPluginSettings = {
  host: "",
  apiKey: "",

  abDir: "",
  abEnable: false,
  abLib: "",
  abSortBy: "",
  abTemplate: "",

  ebDir: "",
  ebEnable: false,
  ebLib: "",
  ebSortBy: "",
  ebTemplate: "",
  
  podDir: "",
  podEnable: false,
  podLib: "",
  podSortBy: "",
  podTemplate: "",
};

export default class ABSPlugin extends Plugin {
  settings: ABSPluginSettings;

  async loadSettings() {
    this.settings = Object.assign(
      {}, 
      DEFAULT_SETTINGS, 
      await this.loadData()
    );
  }

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new ABSPluginSettingTab(this.app, this));

    const ribbonIconEl = this.addRibbonIcon("audio-file", "ABS", () => {
      new Notice("Fetching audiobooks...");
      this.fetchAndCreateNotes();
    });

    this.addCommand({
      id: "fetch-books",
      name: "Fetch books and create notes",
      callback: async () => {
        await this.fetchAndCreateNotes();
      },
    });
  }

  async fetchAndCreateNotes() {
    if (!this.settings.host || !this.settings.apiKey) {
      new Notice("Please configure API settings in the Audiobookshelf Importer settings.");
      return;
    }
    if ((this.settings.abEnable === false) && (this.settings.ebEnable === false) && (this.settings.podEnable === false) ) {
      new Notice("Please enable a library to import in the Audiobookshelf Importer settings.");
      return;
    }

    if (this.settings.abEnable === true) {
      this.abImport()
    }

    // if (this.settings.ebEnable === true) {
    //   this.ebImport()
    // }

    // if (this.settings.podEnable === true) {
    //   this.podImport()
    // }
  }

  async abImport() {
    const apiUrl = `https://${this.settings.host}/api/libraries/${this.settings.abLib}/items?sort=media.metadata.title`;

    try {
      const response = await request({
        url: apiUrl,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`,
        },
      });
  

      if (!response) {
        throw new Error(`Failed to fetch books: ${response}`);
      }

    const data = JSON.parse(response);
    
    const books = (data.results || [])
      .map((book: any) => ({
        id: book.id,
        relPath: book.relPath,
        metadata: book.media?.metadata || {}, 
      }));

    const folder = this.app.vault.getAbstractFileByPath(this.settings.abDir);
    if (!folder) {
      await this.app.vault.createFolder(this.settings.abDir);
    }

    const abJsonData : any = {};
    for (const book of books) {
      var metadata = book.metadata;
      abJsonData.metadata = metadata;
      abJsonData.authorName = metadata.authorName;
      abJsonData.authorNameLF = metadata.authorNameLF;
      abJsonData.coverURL = `https://${this.settings.host}/audiobookshelf/api/items/${book.id}/cover`;
      abJsonData.description = metadata.description;
      abJsonData.jsonData = JSON.stringify(book, null, 2);
      abJsonData.narrator = metadata.narrator;
      abJsonData.publishedDate = metadata.publishedDate;
      abJsonData.publishedYear = metadata.publishedYear;
      abJsonData.publisher = metadata.publisher;
      abJsonData.title = metadata.title;

      const sanitizedTitle = metadata.title.replace(/[\/:*?"<>|]/g, "");

      var sortArtist = abJsonData.authorNameLF
      if (this.settings.abSortBy == "authorNameLF") {
        sortArtist = abJsonData.authorNameLF
      }else if (this.settings.abSortBy == "authorName") {
        sortArtist = abJsonData.authorName
      }

      var filePath = `${this.settings.abDir}/${sortArtist}/${sanitizedTitle}.md`;

      const regex = /\b\d+(\.\d+)?,/;

      if (book.metadata.seriesName != "") {
        var origName = book.metadata.seriesName
        if (regex.test(origName)) {
          const parts = origName.split(/(?<=\b\d+(\.\d+)?),\s*/);
          origName = parts[0]
        }
        const seriesTitle = origName.replace(/\s+#\d+(\.\d+)?$/, "").trim();
        const numberMatch = origName.match(/\s+#(\d+(\.\d+)?)$/);
        const number = numberMatch ? numberMatch[1] : null;
        filePath = `${this.settings.abDir}/${sortArtist}/${seriesTitle}/${number} | ${sanitizedTitle}.md`;
      }

      // console.log(filePath)
      if (!this.app.vault.getAbstractFileByPath(filePath)) {
        await this.ensureFolderExists(filePath);
        await this.app.vault.create(filePath, this.getBookTemplate(abJsonData))
        // await this.app.vault.create(filePath, JSON.stringify(book, null, 2));
        // console.log(`Created: ${filePath}`);
      } else {
        // console.log(`Skipped: ${filePath} (Already exists)`);
      }
    }
      new Notice("Books fetched and notes created successfully!");
    } catch (error) {
      console.error("Error fetching books:", error, " from ", apiUrl);
      new Notice("Failed to fetch books. Check the console for details.");
    }
  }

  async ensureFolderExists(filePath: string) {
    const folderPath = filePath.substring(0, filePath.lastIndexOf("/"));
  
    if (!folderPath) return;
  
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await this.app.vault.createFolder(folderPath);
      console.log(`Created folder: ${folderPath}`);
    }
  }

  getBookTemplate(abJsonData: { [x: string]: any; }) {
    return this.settings.abTemplate
      .replace(/{{(.*?)}}/g, (_, key) => {
        return abJsonData[key.trim()] || "";
        });
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class ABSPluginSettingTab extends PluginSettingTab {
  plugin: ABSPlugin;

  constructor(app: App, plugin: Plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Audiobookshelf Importer Settings" });

    new Setting(containerEl)
      .setName("ABS Host")
      .setDesc("Enter the base URL (without \"https://\")")
      .addText((text) =>
        text
          .setPlaceholder("example.abs.org")
          .setValue(this.plugin.settings.host)
          .onChange(async (value) => {
            this.plugin.settings.host = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Enter your API Key")
      .addText((text) =>
        text
          .setPlaceholder("<apiKey>")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Audiobooks")
      .setDesc("Toggle to enable + show settings.")
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.abEnable)
          .onChange(async (value) => {
            this.plugin.settings.abEnable = value;
            await this.plugin.saveSettings();
            abFieldsContainer.style.display = value ? "block" : "none";
          });
      });
  
    const abWrapper = containerEl.createDiv({ cls: "stacked-inputs" });
    const abFieldsContainer = abWrapper.createDiv({ cls: "fields-container" });

    const abDirContainer = abFieldsContainer.createDiv();
    abDirContainer.createEl("label", { text: "Local Directory:", cls: "ab-setting-item-name" });
    new Setting(abDirContainer)
      .addText(text => {
        text
          .setPlaceholder("ABS/Audiobooks")
          .setValue(this.plugin.settings.abDir)
          .onChange(async (value) => {
            this.plugin.settings.abDir = value;
            await this.plugin.saveSettings();
          });

        text.inputEl.style.width = "100%";
      });

    const abLibContainer = abFieldsContainer.createDiv();
    abLibContainer.createEl("label", { text: "Library ID:", cls: "ab-setting-item-name" });
    new Setting(abLibContainer)
      .addText(text => {
        text
          .setPlaceholder("ads76yfsd-sd767-p9aa-34dsd-989s8dasd")
          .setValue(this.plugin.settings.abLib)
          .onChange(async (value) => {
            this.plugin.settings.abLib = value;
            await this.plugin.saveSettings();
          });

        text.inputEl.style.width = "100%";
      });

    const abSortByContainer = abFieldsContainer.createDiv();
    abSortByContainer.createEl("label", { text: "Page Sort:", cls: "ab-setting-item-name" });
    new Setting(abSortByContainer)
      .addDropdown((dropdown) => {
        const options = {
          ["authorName" /* authorName */]: "Author Name | FN, LN (Asc)",
          ["authorNameLF" /* authorNameLF */]: "Author Name | LN, FN (Asc)",
        };
        dropdown
          .addOptions(options)
          .setValue(this.plugin.settings.abSortBy)
          .onChange(async (value) => {
            console.log("value", value);
            this.plugin.settings.abSortBy = value;
            await this.plugin.saveSettings();
        });
        dropdown.selectEl.style.width = "100%";
      });

    const abTemplateContainer = abFieldsContainer.createDiv();
    abTemplateContainer.createEl("label", { text: "Page Template:", cls: "ab-setting-item-name" });
    new Setting(abTemplateContainer)
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("<!--!>")
          .setValue(this.plugin.settings.abTemplate)
          .onChange(async (value) => {
            this.plugin.settings.abTemplate = value.trim();
            await this.plugin.saveSettings();
          })
        textArea.inputEl.style.height = "150px";
        textArea.inputEl.style.width = "100%";
      });
    abWrapper.appendChild(abFieldsContainer);
    abFieldsContainer.style.display = this.plugin.settings.abEnable ? "block" : "none";
  
    new Setting(containerEl)
      .setName("eBooks")
      .setDesc("Toggle to enable + show settings.")
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.ebEnable)
          .onChange(async (value) => {
            this.plugin.settings.ebEnable = value;
            await this.plugin.saveSettings();
            ebFieldsContainer.style.display = value ? "block" : "none";
          });
      });

    const ebWrapper = containerEl.createDiv({ cls: "stacked-inputs" });
    const ebFieldsContainer = ebWrapper.createDiv({ cls: "fields-container" });

    const ebDirContainer = ebFieldsContainer.createDiv();
    ebDirContainer.createEl("label", { text: "Local Directory:", cls: "eb-setting-item-name" });

    new Setting(ebDirContainer)
      .addText(text => {
        text
          .setPlaceholder("ABS/eBooks")
          .setValue(this.plugin.settings.ebDir)
          .onChange(async (value) => {
            this.plugin.settings.ebDir = value;
            await this.plugin.saveSettings();
          });

        text.inputEl.style.width = "100%";
      });

    const ebLibContainer = ebFieldsContainer.createDiv();
    ebLibContainer.createEl("label", { text: "Library ID:", cls: "eb-setting-item-name" });
    new Setting(ebLibContainer)
      .addText(text => {
        text
          .setPlaceholder("ads76yfsd-sd767-p9aa-34dsd-989s8dasd")
          .setValue(this.plugin.settings.ebLib)
          .onChange(async (value) => {
            this.plugin.settings.ebLib = value;
            await this.plugin.saveSettings();
          });

        text.inputEl.style.width = "100%";
      });

    const ebSortByContainer = ebFieldsContainer.createDiv();
    ebSortByContainer.createEl("label", { text: "Page Sort:", cls: "eb-setting-item-name" });
    new Setting(ebSortByContainer)
      .addDropdown((dropdown) => {
        const options = {
          ["authorName" /* authorName */]: "Author Name | FN, LN (Asc)",
          ["authorNameLF" /* authorNameLF */]: "Author Name | LN, FN (Asc)",
        };
        dropdown
          .addOptions(options)
          .setValue(this.plugin.settings.ebSortBy)
          .onChange(async (value) => {
            console.log("value", value);
            this.plugin.settings.ebSortBy = value;
            await this.plugin.saveSettings();
        });
        dropdown.selectEl.style.width = "100%";
      });

    const ebTemplateContainer = ebFieldsContainer.createDiv();
    ebTemplateContainer.createEl("label", { text: "Page Template:", cls: "eb-setting-item-name" });
    new Setting(ebTemplateContainer)
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("<!--!>")
          .setValue(this.plugin.settings.ebTemplate)
          .onChange(async (value) => {
            this.plugin.settings.ebTemplate = value.trim();
            await this.plugin.saveSettings();
          })
        textArea.inputEl.style.height = "150px";
        textArea.inputEl.style.width = "100%";
      });
    ebWrapper.appendChild(ebFieldsContainer);
    ebFieldsContainer.style.display = this.plugin.settings.ebEnable ? "block" : "none";

    new Setting(containerEl)
    .setName("Podcasts")
    .setDesc("Toggle to enable + show settings.")
    .addToggle(toggle => {
      toggle
        .setValue(this.plugin.settings.podEnable)
        .onChange(async (value) => {
          this.plugin.settings.podEnable = value;
          await this.plugin.saveSettings();
          podFieldsContainer.style.display = value ? "block" : "none";
        });
    });

    const podWrapper = containerEl.createDiv({ cls: "stacked-inputs" });
    const podFieldsContainer = podWrapper.createDiv({ cls: "fields-container" });

    const podDirContainer = podFieldsContainer.createDiv();
    podDirContainer.createEl("label", { text: "Local Directory:", cls: "pod-setting-item-name" });
    new Setting(podDirContainer)
      .addText(text => {
        text
          .setPlaceholder("ABS/Podcasts")
          .setValue(this.plugin.settings.podDir)
          .onChange(async (value) => {
            this.plugin.settings.podDir = value;
            await this.plugin.saveSettings();
          });

        text.inputEl.style.width = "100%";
      });

    const podLibContainer = podFieldsContainer.createDiv();
    podLibContainer.createEl("label", { text: "Library ID:", cls: "pod-setting-item-name" });
    new Setting(podLibContainer)
      .addText(text => {
        text
          .setPlaceholder("ads76yfsd-sd767-p9aa-34dsd-989s8dasd")
          .setValue(this.plugin.settings.podLib)
          .onChange(async (value) => {
            this.plugin.settings.podLib = value;
            await this.plugin.saveSettings();
          });

        text.inputEl.style.width = "100%";
      });

    const podSortByContainer = podFieldsContainer.createDiv();
    podSortByContainer.createEl("label", { text: "Page Sort:", cls: "pod-setting-item-name" });
    new Setting(podSortByContainer)
      .addDropdown((dropdown) => {
        const options = {
          ["authorName" /* authorName */]: "Author Name | FN, LN (Asc)",
          ["authorNameLF" /* authorNameLF */]: "Author Name | LN, FN (Asc)",
        };
        dropdown
          .addOptions(options)
          .setValue(this.plugin.settings.podSortBy)
          .onChange(async (value) => {
            console.log("value", value);
            this.plugin.settings.podSortBy = value;
            await this.plugin.saveSettings();
        });
        dropdown.selectEl.style.width = "100%";
      });

    const podTemplateContainer = podFieldsContainer.createDiv();
    podTemplateContainer.createEl("label", { text: "Page Template:", cls: "pod-setting-item-name" });
    new Setting(podTemplateContainer)
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("<!--!>")
          .setValue(this.plugin.settings.podTemplate)
          .onChange(async (value) => {
            this.plugin.settings.podTemplate = value.trim();
            await this.plugin.saveSettings();
          })
        textArea.inputEl.style.height = "150px";
        textArea.inputEl.style.width = "100%";
      });
    podWrapper.appendChild(podFieldsContainer);
    podFieldsContainer.style.display = this.plugin.settings.podEnable ? "block" : "none";

  }
}

