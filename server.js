// database is let instead of const to allow us to modify it in test.js
let database = {
  comments: {},
  users: {},
  articles: {},
  nextArticleId: 1,
  nextCommentId: 1,
};

const routes = {
  '/users': {
    'POST': getOrCreateUser
  },
  '/users/:username': {
    'GET': getUser
  },
  '/articles': {
    'GET': getArticles,
    'POST': createArticle
  },
  '/articles/:id': {
    'GET': getArticle,
    'PUT': updateArticle,
    'DELETE': deleteArticle
  },
  '/articles/:id/upvote': {
    'PUT': upvoteArticle
  },
  '/articles/:id/downvote': {
    'PUT': downvoteArticle
  },
  '/comments': {
    'POST': (url, req) => {
      // create response object
      const res = { status: null, body: {} };

      // check for body on req and comment on body
      if (!req.body || !req.body.comment) {
        res.status = 400;
        return res;
      }

      const { comment } = req.body;

      // validate article existing
      if (!database.articles.hasOwnProperty(comment.articleId)) {
        res.status = 400;
        res.body.comment = comment;
        return res;
      }

      // validate comment properties
      // using ! will cover if body/comment is null, undefined or empty string
      if (!database.users.hasOwnProperty(comment.username) || !comment.body || !comment.articleId) {
        res.status = 400;
        res.body.comment = comment;
        return res;
      }
      
      // handle initialization of new comment
      const newComment = { [database.nextCommentId]: comment };
      newComment[database.nextCommentId].id = database.nextCommentId;
      newComment[database.nextCommentId].upvotedBy = [];
      newComment[database.nextCommentId].downvotedBy = [];

      database.comments = { ...database.comments, ...newComment};
      
      // handle adding commentId to user object
      database.users[comment.username].commentIds.push(database.nextCommentId);

      //handle adding commentId to article object
      database.articles[comment.articleId].commentIds.push(database.nextCommentId);

      // add 201 for successful call and comment
      res.status = 201;
      res.body.comment = newComment[database.nextCommentId];

      //increment comment ID
      database.nextCommentId += 1;

      return res;
    }
  },
  '/comments/:id': {
    'PUT': (url, req) => {
      // create response object
      const res = { status: null, body: {} };

      //get id
      const id = url.split('/')[2];

      // check for comment in database
      if (!database.comments[id]) {
        res.status = 404;
        return res;
      }

      // check for body, comment, and comment body
      if (!req.body || !req.body.comment || !req.body.comment.body) {
        res.status = 400;
        return res;
      }
      
      // the only valid property to change is the body
      database.comments[id].body = req.body.comment.body;
      res.body = req.body;
      res.status = 200;
      return res;
    },
    'DELETE': url => {
      // create response object
      const res = { status: null, body: {} };

      //get id
      const id = url.split('/')[2];

      // handle for when id trying to be deleted doesn't exist
      if (!database.comments[id]) {
        res.status = 404;
        return res;
      }

      // save comment before deleted
      const deletedComment = database.comments[id];
      
      // instead of deleting, test want comment set to null
      database.comments[id] = null;

      // find index and remove from authors comment array
      const commentIndex = database.users[deletedComment.username].commentIds.findIndex(commentId => {
        return commentId === deletedComment.id;
      });
      database.users[deletedComment.username].commentIds.splice(commentIndex, 1);

      // find index and remove from articles array
      const articleIndex = database.articles[deletedComment.id].commentIds.findIndex(articleId => {
        return articleId === deletedComment.id;
      });
      database.articles[deletedComment.id].commentIds.splice(articleIndex, 1);

      res.status = 204;
      res.body.comment = deletedComment;
      return res;
    }
  },
  '/comments/:id/upvote': {
    'PUT': (url, req) => {
      // create response object
      const res = { status: null, body: {} };

      if (!req.body || !req.body.username) {
        res.status = 400;
        return res;
      }

      //get id and user
      const id = url.split('/')[2];
      const { username } = req.body;

      // return 400 if username or comment id doesnt exist      
      if (!database.users[username] || !database.comments[id]) {
        res.status = 400;
        return res;
      }

      // remove the ability to double upvote
      const exists = database.comments[id].upvotedBy.findIndex(user => {
        return user === username;
      });

      if (exists >= 0) {
        return;
      }

      // if user already downvoted, remove downvote from list
      const hasDownvoted = database.comments[id].downvotedBy.findIndex(user => {
        return user === username;
      });

      if (hasDownvoted >= 0) {
        database.comments[id].downvotedBy.splice(hasDownvoted, 1);
      }

      // add upvote to list
      database.comments[id].upvotedBy.push(username);

      res.status = 200;
      res.body.comment = database.comments[id];
      return res;
    }
  },
  '/comments/:id/downvote': {
    'PUT': (url, req) => {
      // create response object
      const res = { status: null, body: {} };

      if (!req.body || !req.body.username) {
        res.status = 400;
        return res;
      }

      //get id and user
      const id = url.split('/')[2];
      const { username } = req.body;

      // return 400 if username or comment id doesnt exist
      if (!database.users[username] || !database.comments[id]) {
        res.status = 400;
        return res;
      }

      // remove the ability to double downvote
      const exists = database.comments[id].downvotedBy.findIndex(user => {
        return user === username;
      });

      if (exists >= 0) {
        return;
      }

      // if user already upvoted, remove upvote from list
      const hasUpvoted = database.comments[id].upvotedBy.findIndex(user => {
        return user === username;
      });

      if (hasUpvoted >= 0) {
        database.comments[id].upvotedBy.splice(hasUpvoted, 1);
      }

      // add dvote to list
      database.comments[id].downvotedBy.push(username);

      res.status = 200;
      res.body.comment = database.comments[id];
      return res;
    }
  }
};

function getUser(url, request) {
  const username = url.split('/').filter(segment => segment)[1];
  const user = database.users[username];
  const response = {};

  if (user) {
    const userArticles = user.articleIds.map(
        articleId => database.articles[articleId]);
    const userComments = user.commentIds.map(
        commentId => database.comments[commentId]);
    response.body = {
      user: user,
      userArticles: userArticles,
      userComments: userComments
    };
    response.status = 200;
  } else if (username) {
    response.status = 404;
  } else {
    response.status = 400;
  }

  return response;
}

function getOrCreateUser(url, request) {
  const username = request.body && request.body.username;
  const response = {};

  if (database.users[username]) {
    response.body = {user: database.users[username]};
    response.status = 200;
  } else if (username) {
    const user = {
      username: username,
      articleIds: [],
      commentIds: []
    };
    database.users[username] = user;

    response.body = {user: user};
    response.status = 201;
  } else {
    response.status = 400;
  }

  return response;
}

function getArticles(url, request) {
  const response = {};

  response.status = 200;
  response.body = {
    articles: Object.keys(database.articles)
        .map(articleId => database.articles[articleId])
        .filter(article => article)
        .sort((article1, article2) => article2.id - article1.id)
  };

  return response;
}

function getArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const article = database.articles[id];
  const response = {};

  if (article) {
    article.comments = article.commentIds.map(
      commentId => database.comments[commentId]);

    response.body = {article: article};
    response.status = 200;
  } else if (id) {
    response.status = 404;
  } else {
    response.status = 400;
  }

  return response;
}

function createArticle(url, request) {
  const requestArticle = request.body && request.body.article;
  const response = {};

  if (requestArticle && requestArticle.title && requestArticle.url &&
      requestArticle.username && database.users[requestArticle.username]) {
    const article = {
      id: database.nextArticleId++,
      title: requestArticle.title,
      url: requestArticle.url,
      username: requestArticle.username,
      commentIds: [],
      upvotedBy: [],
      downvotedBy: []
    };

    database.articles[article.id] = article;
    database.users[article.username].articleIds.push(article.id);

    response.body = {article: article};
    response.status = 201;
  } else {
    response.status = 400;
  }

  return response;
}

function updateArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const savedArticle = database.articles[id];
  const requestArticle = request.body && request.body.article;
  const response = {};

  if (!id || !requestArticle) {
    response.status = 400;
  } else if (!savedArticle) {
    response.status = 404;
  } else {
    savedArticle.title = requestArticle.title || savedArticle.title;
    savedArticle.url = requestArticle.url || savedArticle.url;

    response.body = {article: savedArticle};
    response.status = 200;
  }

  return response;
}

function deleteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const savedArticle = database.articles[id];
  const response = {};

  if (savedArticle) {
    database.articles[id] = null;
    savedArticle.commentIds.forEach(commentId => {
      const comment = database.comments[commentId];
      database.comments[commentId] = null;
      const userCommentIds = database.users[comment.username].commentIds;
      userCommentIds.splice(userCommentIds.indexOf(id), 1);
    });
    const userArticleIds = database.users[savedArticle.username].articleIds;
    userArticleIds.splice(userArticleIds.indexOf(id), 1);
    response.status = 204;
  } else {
    response.status = 400;
  }

  return response;
}

function upvoteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const username = request.body && request.body.username;
  let savedArticle = database.articles[id];
  const response = {};

  if (savedArticle && database.users[username]) {
    savedArticle = upvote(savedArticle, username);

    response.body = {article: savedArticle};
    response.status = 200;
  } else {
    response.status = 400;
  }

  return response;
}

function downvoteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const username = request.body && request.body.username;
  let savedArticle = database.articles[id];
  const response = {};

  if (savedArticle && database.users[username]) {
    savedArticle = downvote(savedArticle, username);

    response.body = {article: savedArticle};
    response.status = 200;
  } else {
    response.status = 400;
  }

  return response;
}

function upvote(item, username) {
  if (item.downvotedBy.includes(username)) {
    item.downvotedBy.splice(item.downvotedBy.indexOf(username), 1);
  }
  if (!item.upvotedBy.includes(username)) {
    item.upvotedBy.push(username);
  }
  return item;
}

function downvote(item, username) {
  if (item.upvotedBy.includes(username)) {
    item.upvotedBy.splice(item.upvotedBy.indexOf(username), 1);
  }
  if (!item.downvotedBy.includes(username)) {
    item.downvotedBy.push(username);
  }
  return item;
}

// Write all code above this line.

const http = require('http');
const url = require('url');

const port = process.env.PORT || 4000;
const isTestMode = process.env.IS_TEST_MODE;

const requestHandler = (request, response) => {
  const url = request.url;
  const method = request.method;
  const route = getRequestRoute(url);

  if (method === 'OPTIONS') {
    var headers = {};
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
    headers["Access-Control-Allow-Credentials"] = false;
    headers["Access-Control-Max-Age"] = '86400'; // 24 hours
    headers["Access-Control-Allow-Headers"] = "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept";
    response.writeHead(200, headers);
    return response.end();
  }

  response.setHeader('Access-Control-Allow-Origin', null);
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader(
      'Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  if (!routes[route] || !routes[route][method]) {
    response.statusCode = 400;
    return response.end();
  }

  if (method === 'GET' || method === 'DELETE') {
    const methodResponse = routes[route][method].call(null, url);
    !isTestMode && (typeof saveDatabase === 'function') && saveDatabase();

    response.statusCode = methodResponse.status;
    response.end(JSON.stringify(methodResponse.body) || '');
  } else {
    let body = [];
    request.on('data', (chunk) => {
      body.push(chunk);
    }).on('end', () => {
      body = JSON.parse(Buffer.concat(body).toString());
      const jsonRequest = {body: body};
      const methodResponse = routes[route][method].call(null, url, jsonRequest);
      !isTestMode && (typeof saveDatabase === 'function') && saveDatabase();

      response.statusCode = methodResponse.status;
      response.end(JSON.stringify(methodResponse.body) || '');
    });
  }
};

const getRequestRoute = (url) => {
  const pathSegments = url.split('/').filter(segment => segment);

  if (pathSegments.length === 1) {
    return `/${pathSegments[0]}`;
  } else if (pathSegments[2] === 'upvote' || pathSegments[2] === 'downvote') {
    return `/${pathSegments[0]}/:id/${pathSegments[2]}`;
  } else if (pathSegments[0] === 'users') {
    return `/${pathSegments[0]}/:username`;
  } else {
    return `/${pathSegments[0]}/:id`;
  }
}

if (typeof loadDatabase === 'function' && !isTestMode) {
  const savedDatabase = loadDatabase();
  if (savedDatabase) {
    for (key in database) {
      database[key] = savedDatabase[key] || database[key];
    }
  }
}

const server = http.createServer(requestHandler);

server.listen(port, (err) => {
  if (err) {
    return console.log('Server did not start succesfully: ', err);
  }

  console.log(`Server is listening on ${port}`);
});