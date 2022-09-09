import {Editor, Hotkey, MarkdownView, Plugin, TFile} from "obsidian";
import {BetterPdfSettings, BetterPdfSettingsTab} from "./settings";
import * as pdfjs from "pdfjs-dist";

import PdfAnnotationExtractor from "./src/PdfannotationExtractor";
import {Emoji} from "./emoji";

// @ts-ignore
import worker from "pdfjs-dist/build/pdf.worker.entry";
import * as Pdf_viewer from "pdfjs-dist/web/pdf_viewer";
import {off} from "codemirror";
import {mkdirSync} from "fs";

interface PdfNodeParameters {
	range: Array<number>;
	url: string;
	link: boolean;
	page: number;
	scale: number;
	fit: boolean,
	rotation: number;
	rect: Array<number>;
	id: string;
}

export default class BetterPDFPlugin extends Plugin {
	settings: BetterPdfSettings;

	async onload() {

		console.log("Better PDF loading...");

		this.settings = Object.assign(new BetterPdfSettings(), await this.loadData());


		const statusItem = this.addStatusBarItem();


		this.addRibbonIcon('sync', 'Extract annotations', () => this.processPDFHighlights(statusItem));

		this.addCommand({
			id: 'Create-Paper-Table',
			name: 'Create Paper Table',
			hotkeys: [],
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				let lines = await this.createTable()
				lines.forEach(line => {
					if (!editor.getValue().contains(line)) {
						editor.setValue(editor.getValue() + line)
					}
				})
			}
		});

		this.addSettingTab(new BetterPdfSettingsTab(this.app, this));

		pdfjs.GlobalWorkerOptions.workerSrc = worker;

		this.registerMarkdownCodeBlockProcessor("pdf-annotation", async (src, el, ctx) => {
			// Get Parameters
			let parameters: PdfNodeParameters | null = null;
			try {
				parameters = this.readParameters(src);
			} catch (e) {
				el.createEl("h2", {text: "PDF Parameters invalid: " + e.message});
			}


			//Create PDF Node
			if (parameters !== null) {
				try {
					if (parameters.url.startsWith("./")) {
						// find the substring of path all the way to the last slash
						const filePath = ctx.sourcePath;
						const folderPath = filePath.substring(0, filePath.lastIndexOf("/"));
						parameters.url = folderPath + "/" + parameters.url.substring(2, parameters.url.length);
					}
					//Read Document
					const arrayBuffer = await this.app.vault.adapter.readBinary(parameters.url);
					const buffer = Buffer.from(arrayBuffer);
					const document = await pdfjs.getDocument(buffer).promise;


					//Read pages
					const page = await document.getPage(parameters.page);
					let host = el;

					let annotations = await page.getAnnotations()

					let annotation = annotations.filter(a => a.id == parameters?.id).first()

					if (annotation) {
						//el.createEl("h2", {text: parameters.page + " " + annotation.id});
						//el.createEl("h2", {text: JSON.stringify(annotation)});
						el.createEl("br")

						let rect = annotation.rect//a.parentRect ? a.parentRect : a.rect

						if (!parameters) return;


						if (annotation.parentRect) return;


						// Create hyperlink for Page
						if (parameters.link) {
							const href = el.createEl("a");
							href.href = parameters.url + "#page=" + parameters.page;
							href.className = "internal-link";
							host = href;
						}

						// Render Canvas
						const canvas = host.createEl("canvas");

						canvas.style.width = "100%";


						canvas.style.padding = '0';
						canvas.style.margin = 'auto';
						canvas.style.display = 'block';

						const context = canvas.getContext("2d");

						let scale = this.settings.scale

						const baseViewport = page.getViewport({scale: 1});
						const baseViewportWidth = baseViewport.width;
						const baseViewportHeight = baseViewport.height;
						const baseScale = canvas.clientWidth / baseViewportWidth;

						let width = rect[2] - rect[0]
						let height = rect[3] - rect[1]


						width *= scale
						height *= scale

						let offsetX = -rect[0] * scale
						let offsetY = -(baseViewportHeight - rect[3]) * scale

						const viewport = page.getViewport({
							scale: scale,
							rotation: parameters.rotation,
							offsetX: offsetX,
							offsetY: offsetY,
						});


						canvas.width = Math.floor(width);
						canvas.height = Math.floor(height);


						const renderContext = {
							canvasContext: context,
							viewport: viewport,
						};

						{ // @ts-ignore
							await page.render(renderContext);
						}
					}
				} catch (error) {
					console.error(error)
					el.createEl("h2", {text: error});
				}
			}
		});
	}


	private readParameters(jsonString: string) {
		// "url" : [[file.pdf]] is an invalid json since it misses quotation marks in value
		if (jsonString.contains("[[") && !jsonString.contains('"[[')) {
			jsonString = jsonString.replace("[[", '"[[');
			jsonString = jsonString.replace("]]", ']]"');
		}

		const parameters: PdfNodeParameters = JSON.parse(jsonString);

		//Transform internal Link to external
		if (parameters.url.startsWith("[[")) {
			parameters.url = parameters.url.substr(2, parameters.url.length - 4);
			// @ts-ignore
			parameters.url = this.app.metadataCache.getFirstLinkpathDest(
				parameters.url,
				""
			).path;
		}

		if (parameters.link === undefined) {
			parameters.link = this.settings.link_by_default;
		}

		if (
			parameters.scale === undefined ||
			parameters.scale < 0.1 ||
			parameters.scale > 10.0
		) {
			parameters.scale = 1.0;
		}

		if (parameters.fit === undefined) {
			parameters.fit = this.settings.fit_by_default;
		}

		if (parameters.rotation === undefined) {
			parameters.rotation = 0;
		}

		if (parameters.rect === undefined) {
			parameters.rect = [0, 0, 0, 0];
		}
		return parameters;
	}

	async saveHighlightsToFile(filePath: string, mdString: string) {
		const fileExists = await this.app.vault.adapter.exists(filePath);
		if (fileExists) {
			await this.appendHighlightsToFile(filePath, mdString);
		} else {
			await this.app.vault.create(filePath, mdString);
		}
	}

	async appendHighlightsToFile(filePath: string, note: string) {
		let existingContent = await this.app.vault.adapter.read(filePath);
		if (existingContent.length > 0) {
			existingContent = existingContent + '\r\r';
		}
		await this.app.vault.adapter.write(filePath, existingContent + note);
	}

	extractAnnotations(pdfFile: string, markDownFile: string) {

	}

	private async processPDFHighlights(statusItem: HTMLElement) {
		let searchDirectory = this.settings.searchPath
		let annotationDirectory = this.settings.annotationPath

		if (!await this.app.vault.adapter.exists(searchDirectory)) {
			await this.app.vault.adapter.mkdir(searchDirectory)
		}

		if (!await this.app.vault.adapter.exists(annotationDirectory)) {
			await this.app.vault.adapter.mkdir(annotationDirectory)
		}

		let files = (await this.app.vault.adapter.list(searchDirectory)).files

		let fileCount = files.length
		let progress = 0

		let label = statusItem.createEl("span", {text: "Extracting annotations"});

		let progressBar = statusItem.createEl("progress");
		progressBar.setAttribute("value", progress.toString())
		progressBar.setAttribute("max", fileCount.toString())

		console.log("processPDFHighlights")

		for (const f of files) {

			if (!f.endsWith('.pdf')) continue;
			let filePath = f//
				.replace(searchDirectory, annotationDirectory)//
				.replace(".pdf", ".md");

			console.log("extracting " + f)


			let md: string = await new PdfAnnotationExtractor().extract(f, this.app, this.settings)
			if (md.length > 0)
				await this.app.vault.adapter.write(filePath, md);

			progress += 1
			progressBar.setAttribute("value", progress.toString())
			//extractAnnotations(f, filePath)

		}
		statusItem.removeChild(label)
		statusItem.removeChild(progressBar)

	}

	private async createTable(): Promise<string[]> {
		let searchDirectory = this.settings.searchPath

		let files = (await this.app.vault.adapter.list(searchDirectory)).files

		let result: string[] = []

		for (const f of files) {
			if (!f.endsWith('.pdf')) continue;

			let file = f
				.replace(searchDirectory, "")//
				.replace("/", "")//

			result.push("* [ ] [[" + file + "]] \n")
		}
		return result
	}

	onunload() {
		console.log("unloading Better PDF plugin...");
	}
}
