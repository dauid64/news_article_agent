import { CharacterTextSplitter } from "langchain/text_splitter";

export async function split_text(text: string): Promise<string[]> {
    const splitter = new CharacterTextSplitter({
        separator: ". ",
        chunkSize: 50,
        chunkOverlap: 20,
    })

    const output = await splitter.splitText(text);

    return output
}