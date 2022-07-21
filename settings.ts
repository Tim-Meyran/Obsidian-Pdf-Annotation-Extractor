import {App, Plugin, PluginSettingTab, Setting} from 'obsidian';

declare class BetterPDFPlugin extends Plugin {
	settings: BetterPdfSettings;
}

export class BetterPdfSettings {
	fit_by_default: boolean = false;
	link_by_default: boolean = true;
	show_only_boxes: boolean = true;
	scale: number = 4;
	searchPath: string = "Papers";
	annotationPath: string = "Annotations";
}

export class BetterPdfSettingsTab extends PluginSettingTab {
	plugin: BetterPDFPlugin;

	constructor(app: App, plugin: BetterPDFPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Search Directory")
			.setDesc("Directory in which Pdf Documents will be searched for")
			.addText(component => {
				component.setValue(this.plugin.settings.searchPath)
					.onChange(async (value) => {
						this.plugin.settings.searchPath = value;
						await this.plugin.saveData(this.plugin.settings);
					})
			})

		new Setting(containerEl)
			.setName("Annotation Directory")
			.setDesc("Directory in which annotations will be created")
			.addText(component => {
				component.setValue(this.plugin.settings.annotationPath)
					.onChange(async (value) => {
						this.plugin.settings.annotationPath = value;
						await this.plugin.saveData(this.plugin.settings);
					})
			})


		new Setting(containerEl)
			.setName("Only boxes")
			.setDesc("show only boxes")
			.addToggle(toggle => toggle.setValue(this.plugin.settings.show_only_boxes)
				.onChange(async (value) => {
					this.plugin.settings.show_only_boxes = value;
					await this.plugin.saveData(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName("Pdf Scale")
			.setDesc("Pdf Scale")
			.addSlider(toggle => toggle//

				.setLimits(1, 5, .25)
				.setValue(this.plugin.settings.scale)
				.onChange(async (value) => {
					this.plugin.settings.scale = value;
					await this.plugin.saveData(this.plugin.settings);

				}).setDynamicTooltip()
			);

		new Setting(containerEl)
			.setName("Fit pages by default")
			.setDesc("When turned on, pages will be scaled to the view by default. Can be overridden using the 'fit' parameter")
			.addToggle(toggle => toggle.setValue(this.plugin.settings.fit_by_default)
				.onChange(async (value) => {
					this.plugin.settings.fit_by_default = value;
					await this.plugin.saveData(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName("Link pages by default")
			.setDesc("When turned on, pages will be linked to their document by default. Can be overridden using the 'link' parameter")
			.addToggle(toggle => toggle.setValue(this.plugin.settings.link_by_default)
				.onChange(async (value) => {
					this.plugin.settings.link_by_default = value;
					await this.plugin.saveData(this.plugin.settings);
				}));
	}


}
