import ABSPlugin from "./main";
import { App, PluginSettingTab } from "obsidian";

export class ABSSettingsTab extends PluginSettingTab {
    plugin: ABSPlugin

    contructor(app: App, plugin: ABSPlugin) {
        super(app, plugin);

        this.plugin = plugin;
    }

    display() {
        let { containerEl } = this;

        containerEl.createEl("h1", { text: "Audiobookshelf Importer Settings" });
    }
}