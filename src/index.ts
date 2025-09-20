import { Server } from "./server.js";
import { log, spinner } from "@clack/prompts";
import { BookProcess } from "./bookProcess.js";
// import { Selector } from "./selector.js";

const bookcase = await Server.getBookcase();
for (let i = 0; i < bookcase.length; i++) {
  const book = bookcase[i];
  const s = spinner();
  s.start(`Processing book ${book.title} (${i + 1}/${bookcase.length})`);
  await BookProcess.process(book, s);
  s.stop(`Finished processing book ${book.title}`);
}
log.success("All books processed successfully!");
