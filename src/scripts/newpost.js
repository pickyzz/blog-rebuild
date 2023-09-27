#!/usr/bin/env node
// ref: https://github.com/equk/gatsby-new-post-cli

const fs = require("fs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter file name:", function (initName) {
  const author = "Parinya T.";
  const fileName = initName.replace(/ |:|\./g, "-");
  const dateNow = new Date().toISOString();
  const blogPostFolder = "./src/content/blog";
  const blogPostDate = `${blogPostFolder}/${dateNow}`;

  if (!fs.existsSync(blogPostFolder)) {
    console.log(`ERROR: posts folder not found: ${blogPostFolder}`);
    rl.close();
    process.exit(1);
  }

  const output = `---\nauthor: "${author}"\npubDatetime: ${dateNow}\ntitle: "change me"\npostSlug: "${fileName}"\ndraft: true\ntags:\n - others\nogImage: ""\ndescription: ""\n---\n\n## Table of contents\n\n{/* Write your post content here */}\n\n## บ่นก่อน \n\n`;

  fs.writeFileSync(`${blogPostDate}-${fileName}.mdx`, output);

  console.log(`Post ${fileName} was created successfully`);
  console.log(`Location: ${blogPostDate}-${fileName}.mdx`);
  rl.close();
  process.exit(0);
});
