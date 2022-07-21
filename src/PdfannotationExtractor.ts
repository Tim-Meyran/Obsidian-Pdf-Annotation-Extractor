import * as pdfjs from "pdfjs-dist";
import {App, Plugin, Plugin_2} from "obsidian";
import {BetterPdfSettings} from "../settings";


export default class PdfAnnotationExtractor {

	async extract(url: string, app: App, settings: BetterPdfSettings) {
		try {

			//Read Document
			const arrayBuffer = await app.vault.adapter.readBinary(url);
			const buffer = Buffer.from(arrayBuffer);
			const document = await pdfjs.getDocument(buffer).promise;

			let result = ""

			let lastAnnotationPage = 0
			//Read pages
			for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {

				const page = await document.getPage(pageNumber);

				let annotations = await page.getAnnotations()

				for (const a of annotations) {

					if (a.parentRect) continue;
					if (!a.hasAppearance) continue;

					if (settings.show_only_boxes && a.subtype !== "Square") continue;

					if (pageNumber > lastAnnotationPage) {
						result += "# Page " + pageNumber + "\n"
						lastAnnotationPage = pageNumber
					}

					result += "```pdf-annotation\n"
					result += "{\n"
					result += "\t\"url\":\"" + url + "\",\n"
					result += "\t\"page\":" + pageNumber + ",\n"
					result += "\t\"id\":\"" + a.id + "\"\n"
					result += "}\n"
					result += "```\n"
					if (a.contentsObj && a.contentsObj.str) {
						result += a.contentsObj.str + "\n"
					}
				}
			}
			return result
		} catch (error) {
			console.error(error)

		}

		return ""
	}
}

