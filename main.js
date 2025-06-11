"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const DEFAULT_SETTINGS = {
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
class ABSPlugin extends obsidian_1.Plugin {
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            this.addSettingTab(new ABSPluginSettingTab(this.app, this));
            const ribbonIconEl = this.addRibbonIcon("audio-file", "ABS", () => {
                // new Notice("Fetching audiobooks...");
                this.fetchAndCreateNotes();
            });
            this.addCommand({
                id: "fetch-books",
                name: "Fetch books and create notes",
                callback: () => __awaiter(this, void 0, void 0, function* () {
                    yield this.fetchAndCreateNotes();
                }),
            });
        });
    }
    fetchAndCreateNotes() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.settings.host || !this.settings.apiKey) {
                new obsidian_1.Notice("Please configure API settings in the Audiobookshelf Importer settings.");
                return;
            }
            if ((this.settings.abEnable === false) && (this.settings.ebEnable === false) && (this.settings.podEnable === false)) {
                new obsidian_1.Notice("Please enable a library to import in the Audiobookshelf Importer settings.");
                return;
            }
            if (this.settings.abEnable === true) {
                this.abImport();
            }
            if (this.settings.ebEnable === true) {
                this.ebImport();
            }
            if (this.settings.podEnable === true) {
                this.podImport();
            }
        });
    }
    abImport() {
        return __awaiter(this, void 0, void 0, function* () {
            const apiUrl = `https://${this.settings.host}/api/libraries/${this.settings.abLib}/items?sort=media.metadata.title`;
            const meUrl = `https://${this.settings.host}/api/me`;
            try {
                // Fetch audiobooks
                const response = yield (0, obsidian_1.request)({
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
                    .map((book) => {
                    var _a;
                    return ({
                        id: book.id,
                        relPath: book.relPath,
                        metadata: ((_a = book.media) === null || _a === void 0 ? void 0 : _a.metadata) || {},
                    });
                });
                // Fetch bookmarks and mediaProgress
                let bookmarks = [];
                let mediaProgress = [];
                try {
                    const meResponse = yield (0, obsidian_1.request)({
                        url: meUrl,
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${this.settings.apiKey}`,
                        },
                    });
                    if (meResponse) {
                        const meData = JSON.parse(meResponse);
                        bookmarks = Array.isArray(meData.bookmarks) ? meData.bookmarks : [];
                        mediaProgress = Array.isArray(meData.mediaProgress) ? meData.mediaProgress : [];
                    }
                }
                catch (err) {
                    console.warn("Could not fetch bookmarks or mediaProgress:", err);
                }
                // Group bookmarks by libraryItemId
                const bookmarksById = {};
                for (const bm of bookmarks) {
                    if (!bookmarksById[bm.libraryItemId])
                        bookmarksById[bm.libraryItemId] = [];
                    bookmarksById[bm.libraryItemId].push({
                        title: bm.title,
                        time: bm.time,
                        createdAt: bm.createdAt,
                    });
                }
                // Attach bookmarks to books
                const result = books.map((book) => (Object.assign(Object.assign({}, book), { bookmarks: bookmarksById[book.id] || [] })));
                const folder = this.app.vault.getAbstractFileByPath(this.settings.abDir);
                if (!folder) {
                    yield this.app.vault.createFolder(this.settings.abDir);
                }
                // Map mediaProgress to libraryItemId
                const progressById = {};
                for (const mp of mediaProgress) {
                    progressById[mp.libraryItemId] = mp;
                }
                for (const book of books) {
                    const metadata = book.metadata;
                    const bookWithBookmarks = Object.assign(Object.assign({}, book), { bookmarks: bookmarksById[book.id] || [] });
                    const progress = progressById[book.id];
                    const isStarted = !!progress;
                    const isFinished = !!(progress && progress.isFinished);
                    let progressPercent = 0;
                    if (progress && typeof progress.progress === "number" && !isNaN(progress.progress)) {
                        progressPercent = Math.round(progress.progress * 100);
                    }
                    const abJsonData = {
                        metadata,
                        authorName: metadata.authorName,
                        authorNameLF: metadata.authorNameLF,
                        coverURL: `https://${this.settings.host}/audiobookshelf/api/items/${book.id}/cover`,
                        description: metadata.description,
                        jsonData: JSON.stringify(bookWithBookmarks, null, 2),
                        narrator: metadata.narrator,
                        publishedDate: metadata.publishedDate,
                        publishedYear: metadata.publishedYear,
                        publisher: metadata.publisher,
                        title: metadata.title,
                        bookmarks: bookmarksById[book.id] || [],
                        isStarted,
                        isFinished,
                        Progress: progressPercent, // 0-100
                    };
                    const sanitizedTitle = metadata.title.replace(/[\/:*?"<>|]/g, "");
                    let sortArtist = abJsonData.authorNameLF;
                    if (this.settings.abSortBy == "authorNameLF") {
                        sortArtist = abJsonData.authorNameLF;
                    }
                    else if (this.settings.abSortBy == "authorName") {
                        sortArtist = abJsonData.authorName;
                    }
                    let filePath = `${this.settings.abDir}/${sortArtist}/${sanitizedTitle}.md`;
                    const regex = /\b\d+(\.\d+)?,/;
                    if (book.metadata.seriesName != "") {
                        let origName = book.metadata.seriesName;
                        if (regex.test(origName)) {
                            const parts = origName.split(/(?<=\b\d+(\.\d+)?),\s*/);
                            origName = parts[0];
                        }
                        const seriesTitle = origName.replace(/\s+#\d+(\.\d+)?$/, "").trim();
                        const numberMatch = origName.match(/\s+#(\d+(\.\d+)?)$/);
                        const number = numberMatch ? numberMatch[1] : null;
                        filePath = `${this.settings.abDir}/${sortArtist}/${seriesTitle}/${number} | ${sanitizedTitle}.md`;
                    }
                    if (!this.app.vault.getAbstractFileByPath(filePath)) {
                        yield this.ensureFolderExists(filePath);
                        yield this.app.vault.create(filePath, this.getBookTemplate(abJsonData, this.settings.abTemplate));
                    }
                }
                new obsidian_1.Notice("Audiobooks fetched and notes created successfully!");
            }
            catch (error) {
                console.error("Error fetching Audiobooks:", error, " from ", apiUrl);
                new obsidian_1.Notice("Failed to fetch Audiobooks. Check the console for details.");
            }
        });
    }
    ebImport() {
        return __awaiter(this, void 0, void 0, function* () {
            const apiUrl = `https://${this.settings.host}/api/libraries/${this.settings.ebLib}/items?sort=media.metadata.title`;
            try {
                const ebResponse = yield (0, obsidian_1.request)({
                    url: apiUrl,
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${this.settings.apiKey}`,
                    },
                });
                if (!ebResponse) {
                    throw new Error(`Failed to fetch books: ${ebResponse}`);
                }
                const data = JSON.parse(ebResponse);
                const ebBooks = (data.results || [])
                    .map((eBook) => {
                    var _a;
                    return ({
                        id: eBook.id,
                        relPath: eBook.relPath,
                        metadata: ((_a = eBook.media) === null || _a === void 0 ? void 0 : _a.metadata) || {},
                    });
                });
                const folder = this.app.vault.getAbstractFileByPath(this.settings.ebDir);
                if (!folder) {
                    yield this.app.vault.createFolder(this.settings.ebDir);
                }
                const ebJsonData = {};
                for (const eBook of ebBooks) {
                    var metadata = eBook.metadata;
                    ebJsonData.metadata = metadata;
                    ebJsonData.authorName = metadata.authorName;
                    ebJsonData.authorNameLF = metadata.authorNameLF;
                    ebJsonData.coverURL = `https://${this.settings.host}/audiobookshelf/api/items/${eBook.id}/cover`;
                    ebJsonData.description = metadata.description;
                    ebJsonData.jsonData = JSON.stringify(eBook, null, 2);
                    ebJsonData.narrator = metadata.narrator;
                    ebJsonData.publishedDate = metadata.publishedDate;
                    ebJsonData.publishedYear = metadata.publishedYear;
                    ebJsonData.publisher = metadata.publisher;
                    ebJsonData.title = metadata.title;
                    const sanitizedTitle = metadata.title.replace(/[\/:*?"<>|]/g, "");
                    var ebSortArtist = ebJsonData.authorNameLF;
                    if (this.settings.ebSortBy == "authorNameLF") {
                        ebSortArtist = ebJsonData.authorNameLF;
                    }
                    else if (this.settings.ebSortBy == "authorName") {
                        ebSortArtist = ebJsonData.authorName;
                    }
                    var filePath = `${this.settings.ebDir}/${ebSortArtist}/${sanitizedTitle}.md`;
                    const regex = /\b\d+(\.\d+)?,/;
                    if (eBook.metadata.seriesName != "") {
                        var origName = eBook.metadata.seriesName;
                        if (regex.test(origName)) {
                            const parts = origName.split(/(?<=\b\d+(\.\d+)?),\s*/);
                            origName = parts[0];
                        }
                        const seriesTitle = origName.replace(/\s+#\d+(\.\d+)?$/, "").trim();
                        const numberMatch = origName.match(/\s+#(\d+(\.\d+)?)$/);
                        const number = numberMatch ? numberMatch[1] : null;
                        filePath = `${this.settings.ebDir}/${ebSortArtist}/${seriesTitle}/${number} | ${sanitizedTitle}.md`;
                    }
                    // console.log(filePath)
                    if (!this.app.vault.getAbstractFileByPath(filePath)) {
                        yield this.ensureFolderExists(filePath);
                        yield this.app.vault.create(filePath, this.getBookTemplate(ebJsonData, this.settings.ebTemplate));
                        // await this.app.vault.create(filePath, JSON.stringify(book, null, 2));
                        // console.log(`Created: ${filePath}`);
                    }
                    else {
                        // console.log(`Skipped: ${filePath} (Already exists)`);
                    }
                }
                new obsidian_1.Notice("eBooks fetched and notes created successfully!");
            }
            catch (error) {
                console.error("Error fetching eBooks:", error, " from ", apiUrl);
                new obsidian_1.Notice("Failed to fetch eBooks. Check the console for details.");
            }
        });
    }
    podImport() {
        return __awaiter(this, void 0, void 0, function* () {
            const apiUrl = `https://${this.settings.host}/api/libraries/${this.settings.podLib}/items?sort=media.metadata.title`;
            try {
                const podResponse = yield (0, obsidian_1.request)({
                    url: apiUrl,
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${this.settings.apiKey}`,
                    },
                });
                if (!podResponse) {
                    throw new Error(`Failed to fetch books: ${podResponse}`);
                }
                const data = JSON.parse(podResponse);
                const podcasts = (data.results || [])
                    .map((podcast) => {
                    var _a;
                    return ({
                        id: podcast.id,
                        relPath: podcast.relPath,
                        metadata: ((_a = podcast.media) === null || _a === void 0 ? void 0 : _a.metadata) || {},
                    });
                });
                const folder = this.app.vault.getAbstractFileByPath(this.settings.podDir);
                if (!folder) {
                    yield this.app.vault.createFolder(this.settings.podDir);
                }
                var epFilePath = "";
                const podJsonData = {};
                for (const podcast of podcasts) {
                    var metadata = podcast.metadata;
                    podJsonData.metadata = metadata;
                    podJsonData.author = metadata.author;
                    podJsonData.coverURL = metadata.imageUrl;
                    podJsonData.description = metadata.description;
                    podJsonData.jsonData = JSON.stringify(podcast, null, 2);
                    podJsonData.narrator = metadata.narrator;
                    podJsonData.publishedDate = metadata.publishedDate;
                    podJsonData.publishedYear = metadata.publishedYear;
                    podJsonData.publisher = metadata.publisher;
                    podJsonData.title = metadata.title;
                    const sanitizedTitle = metadata.title.replace(/[\/:*?"<>|]/g, "");
                    var epApi = `https://${this.settings.host}/api/items/${podcast.id}?sort=publishedDate`;
                    try {
                        const epResponse = yield (0, obsidian_1.request)({
                            url: epApi,
                            method: "GET",
                            headers: {
                                Authorization: `Bearer ${this.settings.apiKey}`,
                            },
                        });
                        if (!epResponse) {
                            throw new Error(`Failed to fetch episodes: ${epResponse}`);
                        }
                        const epData = JSON.parse(epResponse);
                        const episodes = (epData.media.episodes || [])
                            .map((episode) => ({
                            oldEpisodeId: episode.oldEpisodeId,
                            index: episode.index,
                            season: episode.season,
                            episode: episode.episode,
                            episodeType: episode.episodeType,
                            title: episode.title,
                            subtitle: episode.subtitle,
                            description: episode.description,
                            pubDate: episode.pubDate,
                            audioFile: episode.audioFile
                        }));
                        for (const episode of episodes) {
                            podJsonData.metadata = JSON.stringify(episode.audioFile, null, 2);
                            podJsonData.description = episode.description;
                            podJsonData.jsonData = JSON.stringify(episode.audioFile, null, 2);
                            podJsonData.publishedDate = episode.pubDate;
                            podJsonData.publishedYear = episode.audioFile.metaTags.tagGenre;
                            podJsonData.title = episode.title;
                            const epSanitizedTitle = episode.title.replace(/[\/:*?"<>|]/g, "");
                            epFilePath = `${this.settings.podDir}/${sanitizedTitle}/${epSanitizedTitle}.md`;
                            if (!this.app.vault.getAbstractFileByPath(epFilePath)) {
                                yield this.ensureFolderExists(epFilePath);
                                yield this.app.vault.create(epFilePath, this.getBookTemplate(podJsonData, this.settings.podTemplate));
                                // await this.app.vault.create(filePath, JSON.stringify(book, null, 2));
                                // console.log(`Created: ${filePath}`);
                            }
                            else {
                                // console.log(`Skipped: ${filePath} (Already exists)`);
                            }
                        }
                    }
                    catch (error) {
                        console.error("Error fetching Episodes:", error, " from ", apiUrl);
                        new obsidian_1.Notice("Failed to fetch Episodes. Check the console for details.");
                    }
                }
                new obsidian_1.Notice("Podcasts fetched and notes created successfully!");
            }
            catch (error) {
                console.error("Error fetching Podcasts:", error, " from ", apiUrl);
                new obsidian_1.Notice("Failed to fetch Podcasts. Check the console for details.");
            }
        });
    }
    ensureFolderExists(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const folderPath = filePath.substring(0, filePath.lastIndexOf("/"));
            if (!folderPath)
                return;
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                yield this.app.vault.createFolder(folderPath);
                console.log(`Created folder: ${folderPath}`);
            }
        });
    }
    getBookTemplate(jsonData, template) {
        // Helper to format seconds as hh:mm:ss
        function formatTime(seconds) {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            return [h, m, s].map(unit => unit.toString().padStart(2, "0")).join(":");
        }
        return template.replace(/{{(.*?)}}/g, (_, key) => {
            var _a;
            key = key.trim();
            if (key === "bookmarks" && Array.isArray(jsonData.bookmarks)) {
                if (jsonData.bookmarks.length === 0)
                    return "No bookmarks";
                return jsonData.bookmarks
                    .map((bm) => `- ${bm.title || "Bookmark"} - ${formatTime(bm.time)}`)
                    .join("\n");
            }
            return (_a = jsonData[key]) !== null && _a !== void 0 ? _a : "";
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
}
exports.default = ABSPlugin;
function addTextSetting(container, label, description, placeholder, settingKey) {
    const settingContainer = container.createDiv();
    settingContainer.createEl("label", { text: label, cls: "ab-setting-item-name" });
    new obsidian_1.Setting(settingContainer)
        // .setName(label)
        .setDesc(description)
        .addText(text => {
        text.setPlaceholder(placeholder)
            .setValue(this.plugin.settings[settingKey])
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings[settingKey] = value;
            yield this.plugin.saveSettings();
        }));
        text.inputEl.style.width = "100%";
    });
}
function addDropdownSetting(container, label, settingKey, options) {
    const settingContainer = container.createDiv();
    settingContainer.createEl("label", { text: label, cls: "ab-setting-item-name" });
    new obsidian_1.Setting(settingContainer)
        .addDropdown(dropdown => {
        dropdown.addOptions(options)
            .setValue(this.plugin.settings[settingKey])
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            console.log("value", value);
            this.plugin.settings[settingKey] = value;
            yield this.plugin.saveSettings();
        }));
        dropdown.selectEl.style.width = "100%";
    });
}
function addToggleSetting(container, label, description, settingKey, toggleCallback) {
    const settingContainer = container.createDiv();
    new obsidian_1.Setting(settingContainer)
        .setName(label)
        .setDesc(description)
        .addToggle(toggle => {
        toggle.setValue(this.plugin.settings[settingKey])
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings[settingKey] = value;
            yield this.plugin.saveSettings();
            toggleCallback(value);
        }));
    });
}
function addTextAreaSetting(container, label, placeholder, settingKey) {
    const settingContainer = container.createDiv();
    settingContainer.createEl("label", { text: label, cls: "ab-setting-item-name" });
    new obsidian_1.Setting(settingContainer)
        .addTextArea(textArea => {
        textArea.setPlaceholder(placeholder)
            .setValue(this.plugin.settings[settingKey])
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings[settingKey] = value.trim();
            yield this.plugin.saveSettings();
        }));
        textArea.inputEl.style.height = "150px";
        textArea.inputEl.style.width = "100%";
    });
}
class ABSPluginSettingTab extends obsidian_1.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "Audiobookshelf Importer Settings" });
        addTextSetting.call(this, containerEl, "ABS Host", "Enter the base URL (without \"https://\")", "example.abs.org", "host");
        addTextSetting.call(this, containerEl, "API Key", "Enter your API Key", "<apiKey>", "apiKey");
        addToggleSetting.call(this, containerEl, "Audiobooks", "Toggle to enable + show settings.", "abEnable", (value) => {
            abFieldsContainer.style.display = value ? "block" : "none";
        });
        const abWrapper = containerEl.createDiv({ cls: "stacked-inputs" });
        const abFieldsContainer = abWrapper.createDiv({ cls: "fields-container" });
        addTextSetting.call(this, abFieldsContainer, "Local Directory:", "", "ABS/Audiobooks", "abDir");
        addTextSetting.call(this, abFieldsContainer, "Library ID:", "", "ads76yfsd-sd767-p9aa-34dsd-989s8dasd", "abLib");
        addDropdownSetting.call(this, abFieldsContainer, "Page Sort:", "abSortBy", {
            ["authorName"]: "Author Name | FN, LN (Asc)",
            ["authorNameLF"]: "Author Name | LN, FN (Asc)"
        });
        addTextAreaSetting.call(this, abFieldsContainer, "Page Template:", "<!--!>", "abTemplate");
        abWrapper.appendChild(abFieldsContainer);
        abFieldsContainer.style.display = this.plugin.settings.abEnable ? "block" : "none";
        addToggleSetting.call(this, containerEl, "Ebooks", "Toggle to enable + show settings.", "ebEnable", (value) => {
            ebFieldsContainer.style.display = value ? "block" : "none";
        });
        const ebWrapper = containerEl.createDiv({ cls: "stacked-inputs" });
        const ebFieldsContainer = ebWrapper.createDiv({ cls: "fields-container" });
        addTextSetting.call(this, ebFieldsContainer, "Local Directory:", "", "ABS/Ebooks", "ebDir");
        addTextSetting.call(this, ebFieldsContainer, "Library ID:", "", "ads76yfsd-sd767-p9aa-34dsd-989s8dasd", "ebLib");
        addDropdownSetting.call(this, ebFieldsContainer, "Page Sort:", "ebSortBy", {
            ["authorName"]: "Author Name | FN, LN (Asc)",
            ["authorNameLF"]: "Author Name | LN, FN (Asc)"
        });
        addTextAreaSetting.call(this, ebFieldsContainer, "Page Template:", "<!--!>", "ebTemplate");
        ebWrapper.appendChild(ebFieldsContainer);
        ebFieldsContainer.style.display = this.plugin.settings.ebEnable ? "block" : "none";
        addToggleSetting.call(this, containerEl, "Podcasts", "Toggle to enable + show settings.", "podEnable", (value) => {
            podFieldsContainer.style.display = value ? "block" : "none";
        });
        const podWrapper = containerEl.createDiv({ cls: "stacked-inputs" });
        const podFieldsContainer = podWrapper.createDiv({ cls: "fields-container" });
        addTextSetting.call(this, podFieldsContainer, "Local Directory:", "", "ABS/Podcasts", "podDir");
        addTextSetting.call(this, podFieldsContainer, "Library ID:", "", "ads76yfsd-sd767-p9aa-34dsd-989s8dasd", "podLib");
        addDropdownSetting.call(this, podFieldsContainer, "Page Sort:", "podSortBy", {
            ["authorName"]: "Author Name | FN, LN (Asc)",
            ["authorNameLF"]: "Author Name | LN, FN (Asc)"
        });
        addTextAreaSetting.call(this, podFieldsContainer, "Page Template:", "<!--!>", "podTemplate");
        podWrapper.appendChild(podFieldsContainer);
        podFieldsContainer.style.display = this.plugin.settings.podEnable ? "block" : "none";
    }
}
