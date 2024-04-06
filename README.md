## Powered by Astro & Notion

- V.2.0.0 Based on [Astro-paper](https://github.com/satnaing/astro-paper) theme.

- Notion API as Content Management System base on [AstroNot](https://github.com/jsonMartin/AstroNot)

customized by [Pickyzz](https://github.com/pickyzz)

## Requirements

- Node.js and npm (or yarn, pnpm, bun)

## Work with notion as CMS

- Duplicate [[This]](https://pickyzz.notion.site/b60241fb283943c29acd6bc6c91acc77?v=f688e711757a47339b30e33f1fbf8d7e&pvs=4) Notion template and do not edit the table's name

- Rename .env.example to .env and add your `NOTION_KEY` key and `DATABASE_ID`

- To sync posts for developing use `npm run sync` or `npm run sync:published`

- use `npm run generate` get all published posts and build for production

### Developing

Run the following command on your local environment:

Then, you can run locally in development mode with live reload:

```bash
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) with your favorite browser
to see your project.

### Deploy to production (manual)

You can create an optimized production build with:

```shell
npm run build
```

or

```shell
npm run generate
```

Now, your blog is ready to be deployed. All generated files are located at
`dist` folder, which you can deploy the folder to any hosting service you
prefer.

## 🧞 All Commands

Note: run from the root of the project, from a terminal:

| Command                 | Action                                                  |
| :---------------------- | :------------------------------------------------------ |
| `npm install`           | Installs dependencies                                   |
| `npm run dev`           | Starts local dev server at `localhost:3000`             |
| `npm run build`         | Build your production site to `./dist/`                 |
| `npm run preview`       | Preview your build locally, before deploying            |
| `npm run clean`         | Remove `./dist` folder                                  |
| `npm run format`        | Run ESLint and report styling error                     |
| `npm run sync`          | Sync all posts from notion database                     |
| `npm run sync:publised` | Sync only published post from notion database           |
| `npm run generate`      | Sync published post and build static site for deploying |
