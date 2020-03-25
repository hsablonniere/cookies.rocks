'use strict';

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const express = require('express');
const url = require('url');

function randomToken (byteLength = 20) {
  return crypto
    .randomBytes(byteLength)
    .toString('base64')
    .replace(/\//g, '-')
    .replace(/\+/g, '_')
    .replace(/=/g, '');
}

const app = express();

app.disable('etag');
app.disable('x-powered-by');
app.set('view engine', 'ejs');

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));

// I know :-(
const cache = {};
const etagCache = {};

app.use((req, res, next) => {

  const host = req.hostname.startsWith('cookies')
    ? 'root'
    : req.hostname.startsWith('blue')
      ? 'blue'
      : req.hostname.startsWith('green')
        ? 'green'
        : null;

  if (req.url === '/' || req.url === '/index.html') {
    res.render('index.ejs', { host });
  }

  if (req.url === '/simple-session.html') {
    res.set('Set-Cookie', `simple-session=hello`);
    res.render('simple-session.ejs', { host });
  }

  if (req.url === '/simple-persistent.html') {
    res.set('Set-Cookie', `simple-persistent=hello; Max-Age=3600`);
    res.render('simple-persistent.ejs', { host });
  }

  if (req.url.endsWith('/show-cookies.html')) {
    res.render('show-cookies.ejs', {
      host,
      cookieHeader: req.headers.cookie,
      cookies: Object.entries(req.cookies),
    });
  }

  if (req.url === '/delete-simple-cookies.html') {
    res.set('Set-Cookie', [
      `simple-session=; Max-Age=0`,
      `simple-persistent=; Expires=${new Date(0).toUTCString()}`,
    ]);
    res.redirect(302, '/show-cookies.html');
  }

  if (req.url === '/domain-attribute.html') {
    res.set('Set-Cookie', [
      `no-domain=no`,
      `root-domain=root; Domain=cookies.rocks`,
      `blue-subdomain=blue; Domain=blue.cookies.rocks`,
      `green-subdomain=green; Domain=green.cookies.rocks`,
    ]);
    res.redirect(302, '/show-cookies.html');
  }

  if (req.url === '/path-attribute.html') {
    res.set('Set-Cookie', [
      `no-path=no`,
      `foo-path=foo; Path=/foo`,
      `bar-path=bar; Path=/bar`,
    ]);
    res.redirect(302, '/show-cookies.html');
  }

  if (req.url === '/secure-attribute.html') {
    res.set('Set-Cookie', [
      `no-secure=no`,
      `secure=secure; Secure`,
    ]);
    res.redirect(302, '/show-cookies.html');
  }

  if (req.url === '/httponly-attribute.html') {
    res.set('Set-Cookie', [
      `no-httponly=no`,
      `httponly=httponly; HttpOnly`,
    ]);
    res.redirect(302, '/show-cookies.html');
  }

  if (req.url.endsWith('/tracking-image.html')) {
    let sites = [];
    const id = req.cookies['id'];
    if (id != null && cache[id] != null) {
      sites = cache[id].sites;
    }
    res.render('tracking-image.ejs', { host, sites });
  }

  if (req.url === '/cookie.svg') {

    let id = req.cookies['id'];
    if (id == null || cache[id] == null) {
      id = randomToken();
      cache[id] = { sites: [] };
      res.set('Set-Cookie', `id=${id}`);
    }

    const { referer, 'user-agent': userAgent } = req.headers;
    if (referer != null && !referer.endsWith('/tracking-image.html')) {
      cache[id].sites.push({ date: new Date().getTime(), referer, userAgent });
    }

    console.log(cache);
  }

  if (req.path.startsWith('/tracking-image-etag.html')) {
    let sites = [];
    let id = req.query.id;
    if (id == null) {
      id = randomToken();
      res.redirect(302, `/tracking-image-etag.html?id=${id}`);
      return;
    }
    const cacheResult = Object.entries(etagCache)
      .find(([cacheId, { refererId }]) => refererId === id);
    if (id != null && cacheResult != null) {
      sites = cacheResult[1].sites;
    }
    res.render('tracking-image-etag.ejs', { host, sites });
  }

  if (req.url === '/cookie-etag.svg') {

    let id = req.headers['if-none-match'];
    if (id == null || etagCache[id] == null) {
      id = randomToken();
      etagCache[id] = { sites: [] };
    }
    res.set('ETag', id);

    const { referer, 'user-agent': userAgent } = req.headers;
    if (referer != null) {
      if (referer.includes('/tracking-image-etag.html')) {
        const refererId = new url.URL(referer).searchParams.get('id');
        etagCache[id].refererId = refererId;
      }
      else {
        etagCache[id].sites.push({ date: new Date().getTime(), referer, userAgent });
      }
    }

    console.log(etagCache);
  }

  if (req.url === '/profile.html') {
    let id = req.cookies['id'];
    if (id == null || cache[id] == null) {
      id = randomToken();
      cache[id] = { sites: [] };
      res.set('Set-Cookie', `id=${id}`);
    }
    const profile = cache[id].profile;
    res.render('profile.ejs', { host, profile });
  }

  if (req.path === '/update-profile.html') {
    let id = req.cookies['id'];
    if (id == null || cache[id] == null) {
      id = randomToken();
      cache[id] = { sites: [] };
      res.set('Set-Cookie', `id=${id}`);
    }
    cache[id].profile = {
      firstname: req.query.firstname || req.body.firstname,
      lastname: req.query.lastname || req.body.lastname,
    };
    res.redirect(302, './profile.html');
  }

  if (req.path === '/test-post-samesite.html') {
    const { token } = req.body;
    res.set('Set-Cookie', [
      `token-default=${token}; Max-Age=5356800; Domain=.cookies.rocks; Secure; Path=/; HttpOnly`,
      `token-none=${token}; Max-Age=5356800; Domain=.cookies.rocks; Secure; Path=/; HttpOnly; SameSite=None`,
      `token-lax=${token}; Max-Age=5356800; Domain=.cookies.rocks; Secure; Path=/; HttpOnly; SameSite=Lax`,
      `token-strict=${token}; Max-Age=5356800; Domain=.cookies.rocks; Secure; Path=/; HttpOnly; SameSite=Strict`,
      `token-nodomain-default=${token}; Max-Age=5356800; Secure; Path=/; HttpOnly`,
      `token-nodomain-none=${token}; Max-Age=5356800; Secure; Path=/; HttpOnly; SameSite=None`,
      `token-nodomain-lax=${token}; Max-Age=5356800; Secure; Path=/; HttpOnly; SameSite=Lax`,
      `token-nodomain-strict=${token}; Max-Age=5356800; Secure; Path=/; HttpOnly; SameSite=Strict`,
    ]);
    res.redirect(302, '/');
  }

  next();
});

app.use(express.static('public', {
  etag: false,
  maxAge: 0,
  lastModified: false,
}));

const port = process.env.PORT || 8080;
app.listen(port);
