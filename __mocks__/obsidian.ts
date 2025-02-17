import ABSPlugin from "../main";

export class request {}
export class Modal {}
export class Notice {}
export class Plugin {
  loadData() {}
  saveData() {}
  addRibbonIcon() {
    return {
      addClass: () => {}
    };
  }
  addStatusBarItem() {
    return {
      setText: () => {}
    };
  }
  addCommand() {}
  addSettingTab() {}
  registerDomEvent() {}
  registerInterval() {}
}
export class PluginSettingTab {}
export class Setting {}

it('onload should load default settings', async () => {
    const plugin = new ABSPlugin({} as any, {} as any);
    await plugin.onload();
  
    expect(plugin.settings).toEqual({
      folder: "",
      host: "",
      template: "",
      library: "",
      token: ""
    });
  });
