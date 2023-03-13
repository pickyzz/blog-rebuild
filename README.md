#### Powered by Astro

V. 2.0.0 Based on [Astro-paper](https://github.com/satnaing/astro-paper) theme. customized by Pickyzz

[![Netlify Status](https://api.netlify.com/api/v1/badges/07d974e0-37d5-42e4-a2a8-1bb54e449d09/deploy-status)](https://app.netlify.com/sites/startling-meringue-e86223/deploys)

### Requirements

- Node.js and npm (or yarn, pnpm)

### Getting started

Run the following command on your local environment:

Then, you can run locally in development mode with live reload:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your favorite browser
to see your project.

### Deploy to production (manual)

You can create an optimized production build with:

```shell
npm run build
```

Now, your blog is ready to be deployed. All generated files are located at
`dist` folder, which you can deploy the folder to any hosting service you
prefer.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command            | Action                                       |
| :----------------- | :------------------------------------------- |
| `npm install`      | Installs dependencies                        |
| `npm run dev`      | Starts local dev server at `localhost:3000`  |
| `npm run build`    | Build your production site to `./dist/`      |
| `npm run preview`  | Preview your build locally, before deploying |
| `npm run clean`    | Remove `./dist` folder                       |
| `npm run format`   | Run ESLint and report styling error          |
| `npm run newpost`  | create new blog post                         |
| `npm run fastpost` | create new blog post but faster              |

### Additional Checks

This README.md was linted with
[markdownlint](https://github.com/igorshubovych/markdownlint-cli)
