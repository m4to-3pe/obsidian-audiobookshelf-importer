import {  request, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";

interface ABSPluginSettings {
  host: string;
  library: string;
  token: string;
  folder: string;
  template: string;
}

const DEFAULT_SETTINGS: ABSPluginSettings = {
  host: "",
  library: "",
  token: "",
  folder: "",
  template: "",
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

    const ribbonIconEl = this.addRibbonIcon("book", "ABS", () => {
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
    if (!this.settings.host || !this.settings.library || !this.settings.token) {
      new Notice("Please configure API settings in the ABS Plugin settings.");
      return;
    }
    if (!this.settings.folder) {
      new Notice("Please configure destination folder in the ABS Plugin settings.");
      return;
    }

    const apiUrl = `https://${this.settings.host}/api/libraries/${this.settings.library}/items?sort=media.metadata.title`;

    try {
      const response = await request({
        url: apiUrl,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.settings.token}`,
        },
      });
  

      if (!response) {
        throw new Error(`Failed to fetch books: ${response}`);
      }

    const data = JSON.parse(response);
    
    const books = (data.results || [])
      .map((book: any) => ({
        relPath: book.relPath,
        metadata: book.media?.metadata || {}, 
      }))
      .sort((a, b) => a.relPath.localeCompare(b.relPath)); 

    const folder = this.app.vault.getAbstractFileByPath(`${this.settings.folder}`);
    if (!folder) {
      await this.app.vault.createFolder(`${this.settings.folder}`);
    }

    for (const book of books) {
      var metadata = book.metadata;
      var author = metadata.author;
      var authorNameLF = metadata.authorNameLF;

      const sanitizedTitle = metadata.title.replace(/[\/:*?"<>|]/g, "");
      var filePath = ""

      if (book.metadata.seriesName != "") {
        filePath = `${this.settings.folder}/${authorNameLF}/${book.metadata.seriesName.replace(/\s+#\d+$/, "").trim()}/${sanitizedTitle}.md`;
      } else {
        filePath = `${this.settings.folder}/${authorNameLF}/${sanitizedTitle}.md`;
      }

      if (!this.app.vault.getAbstractFileByPath(filePath)) {
        await this.ensureFolderExists(filePath);
        await this.app.vault.create(filePath, JSON.stringify(book, null, 2));
        console.log(`Created: ${filePath}`);
      } else {
        console.log(`Skipped: ${filePath} (Already exists)`);
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

  getBookTemplate(title) {
    return `# ${title}\n\n## Summary\n\n(Add summary here)\n\n## Notes\n\n(Add your notes here)`;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class ABSPluginSettingTab extends PluginSettingTab {
  plugin: ABSPlugin;

  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "ABS Plugin Settings" });

    new Setting(containerEl)
      .setName("API Host")
      .setDesc("Enter the base URL of the API (without https://)")
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
      .setName("Library")
      .setDesc("Enter the library ID or name")
      .addText((text) =>
        text
          .setPlaceholder("audiobooks")
          .setValue(this.plugin.settings.library)
          .onChange(async (value) => {
            this.plugin.settings.library = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Token")
      .setDesc("Enter your API token")
      .addText((text) =>
        text
          .setPlaceholder("your-token-here")
          .setValue(this.plugin.settings.token)
          .onChange(async (value) => {
            this.plugin.settings.token = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Folder")
      .setDesc("Where to create pages.")
      .addText((text) =>
        text
          .setPlaceholder("ABS")
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Template")
      .setDesc("Template for new pages.")
      .addTextArea((text) =>
        text
          .setPlaceholder("<!--!>")
          .setValue(this.plugin.settings.template)
          .onChange(async (value) => {
            this.plugin.settings.template = value.trim();
            await this.plugin.saveSettings();
          })
      );
  }
}

