# News Article Agent

## ⚙️ Setup

To configure the project, you will first need to have Node and Docker installed on your computer.

Run the following command in the repository’s source code:

```bash
npm i
```

After that, you’ll need to rename the `.env-example` file to `.env` and fill in the environment variables according to your information.

## 🚀 Running

To run the project, first start the Qdrant container, which we’ll use as a vector database:

```bash
docker-compose up -d
```

Navigate to the `src/jobs` folder and open the `rag.ts` file. If you're using VSCode, you can use the debug run option "Launch current file", or you can run the file via the command line.

After this, our vector database will be set up.

To start our API, return to the root of the project and run `npm run dev`, or use the VSCode debug option "Start server".

## ☁️ Design decisions

Due to limited time, I chose to use technologies I’m already familiar with, such as Qdrant for the vector database and OpenAI.

I separated the population script from the vector database in the `src/jobs` folder, which I usually reserve for scripts that I run in batches or reuse frequently in my systems. In this case, we could leave it running in the background and when it receives some new news it stores it in the vector database.

I generally use Qdrant because it's a high-performance vector database built in Rust. Since I’ve worked with Rust, I feel confident it’s a reliable and stable choice.

I use OpenAI due to its comprehensive documentation, multi-language support, and the fact that it works well with Portuguese (which I typically use in my projects). However, in this case, I could experiment with other models like Anthropic or even use Amazon Bedrock to allow flexibility in choosing models.

I created two agents, one responsible for capturing relevant content on news HTML pages and another to answer user questions based on the news content, which I named "CleanHTMLAgent" and "ChatAgent". I used CleanHTMLAgent both in RAG and for the tool I created in my ChatAgent so that whenever a user places a link in the query it searches for it on the internet.

Implemente
## 🆙 Improvements

Given more time, I could implement several improvements to this project. Here are a few:

* Implement a chat identification scheme to preserve each user’s previous messages.

* Summarize the user’s conversations if they become too long.

* Store the tokens and messages of each conversation.

* Improve the division of texts by studying better the structure that best fits

* Include news title embeddings

