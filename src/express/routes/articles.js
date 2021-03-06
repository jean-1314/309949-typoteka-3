'use strict';

const {Router} = require(`express`);

const data = require(`../templates/data`);
const api = require(`../api`).getAPI();
const {OFFERS_PER_PAGE} = require(`../constants`);

const router = Router;
const articlesRouter = router();

const upload = require(`../lib/init-storage`);

articlesRouter.get(`/category/:id`, async (req, res) => {
  const {id} = req.params;

  let {page = 1} = req.query;
  page = +page;
  const limit = OFFERS_PER_PAGE;
  const offset = (page - 1) * OFFERS_PER_PAGE;

  try {
    const [headCategory, categories, {count, articles}] = await Promise.all([
      api.getCategory(id),
      api.getCategories(true),
      api.getArticlesByCategory({limit, offset, categoryId: id}),
    ]);

    const totalPages = Math.ceil(count / OFFERS_PER_PAGE);

    res.render(`articles-by-category`, {...data, headCategory, categories, articles, totalPages, page});
  } catch (e) {
    const {response} = e;
    if (response && response.status === 404) {
      res.render(`errors/400`);
    } else {
      res.render(`errors/500`);
    }
  }
});

articlesRouter.get(`/add`, async (req, res) => {
  const categories = await api.getCategories();
  res.render(`post-form`, {...data, categories, editMode: false});
});

articlesRouter.get(`/edit/:id`, async (req, res) => {
  const {id} = req.params;
  const article = await api.getArticle(id);
  const allCategories = await api.getCategories();

  const categories = article.categories.map((item) => item.id);
  article.categories = categories;

  res.render(`post-form`, {...data, article, categories: allCategories, editMode: true});
});

articlesRouter.get(`/:id`, async (req, res) => {
  const {id} = req.params;
  try {
    const article = await api.getArticle(id); // Если id невалидный, запрос будет только один
    const [comments, categories] = await Promise.all([
      api.getArticleComments(id),
      api.getArticleCategories(id),
    ]);
    res.render(`post`, {...data, article, comments, categories});
  } catch (e) {
    const {response} = e;
    if (response.status === 404) {
      res.render(`errors/400`);
    } else {
      res.render(`errors/500`);
    }
  }
});

articlesRouter.post(`/add`, upload.single(`picture`), async (req, res) => {
  const {body, file} = req;

  const articleData = {
    picture: file ? file.filename : null,
    announce: body.announce,
    fullText: body.fullText,
    title: body.title,
    createdDate: body.createdDate,
    categories: Array.isArray(body.categories) ? body.categories : [body.categories]
  };

  try {
    await api.createArticle(articleData);
    res.redirect(`/my`);
  } catch (error) {
    const errors = error.response.data.messages;
    const categories = await api.getCategories();
    res.render(`post-form`, {...data, article: articleData, categories, errors, editMode: false});
  }
});

articlesRouter.post(`/edit/:id`, upload.single(`picture`), async (req, res) => {
  const {body, file} = req;
  const {id} = req.params;
  let resultCategories = null;

  if (body.categories) {
    resultCategories = Array.isArray(body.categories) ? body.categories : [body.categories];
  }

  const articleData = {
    picture: file
      ? file.filename
      : body.picture,
    announce: body.announce,
    fullText: body.fullText,
    title: body.title,
    createdDate: body.createdDate,
    categories: resultCategories
  };

  try {
    await api.updateArticle(articleData, id);
    res.redirect(`/articles/${id}`);
  } catch (error) {
    const errors = error.response.data.messages;
    const categories = await api.getCategories();
    res.render(`post-form`, {...data, article: articleData, id, categories, errors, editMode: true});
  }
});

articlesRouter.post(`/:id`, async (req, res) => {
  const {body} = req;
  const {id} = req.params;

  const comment = {
    text: body.text,
  };

  let article = null;
  let comments = null;
  let categories = null;

  try {
    const createdComment = await api.createComment(comment, id);
    if (createdComment) {
      article = await api.getArticle(id);
      [comments, categories] = await Promise.all([
        api.getArticleComments(id),
        api.getArticleCategories(id),
      ]);
    }
    res.render(`post`, {...data, article, comments, categories});
  } catch (error) {
    const errors = error.response.data.messages;
    article = await api.getArticle(id);
    [comments, categories] = await Promise.all([
      api.getArticleComments(id),
      api.getArticleCategories(id),
    ]);
    res.render(`post`, {...data, article, comments, categories, errors, text: comment.text});
  }
});

module.exports = articlesRouter;
