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

I chose to use technologies I’m already familiar with, such as Qdrant for the vector database and OpenAI.

I started by creating a script to prepare the vector database, naming it rag.ts in the src/jobs folder, where I usually keep useful scripts for my API. In this script, I connect to OpenAI, Qdrant, and Kafka. I begin consuming the Kafka database, and for each new piece of data that arrives, I take the returned URL, fetch its content, extract only the relevant part (the HTML body), and then call my CleanHTMLAgent to extract important data from the HTML using a structured JSON output. Finally, I generate the embeddings and store them in Qdrant along with the payload returned by my agent.

On the API side, I developed a separate agent for the chat. It’s specialized in performing semantic searches of the content in Qdrant and generating a response for the user based on the returned article. If the user includes a link in the message, it triggers a function that invokes the CleanHTMLAgent again to extract data from the provided link and returns a response based on it.


## 🆙 Improvements

Given more time, I could implement several improvements to this project. Here are a few:

* Returns text streaming to the user

* Implement a chat identification scheme to preserve each user’s previous messages.

* Summarize the user’s conversations if they become too long.

* Store the tokens and messages of each conversation.

* Improve the division of texts by studying better the structure that best fits

* Include the article titles in the vector database

* Perform semantic search only when necessary

