import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import express from "express";

const pagesRouter = express.Router();

pagesRouter.use(express.json());

// Serve static files (CSS, JS, images)
pagesRouter.use(express.static(path.join(__dirname, '../frontend/styles')));

// RENDERING HTML PAGES
pagesRouter.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/Home.html'));
});


// RENDERING HTML PAGES
pagesRouter.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/Home.html'));
});

pagesRouter.get("/coaches", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/Coaches.html'));
});

pagesRouter.get("/shop", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/shop.html'));
});

pagesRouter.get("/plans", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/PlansPage.html'));
});


pagesRouter.get("/cart", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/cart.html'));
});


pagesRouter.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/about.html'));
});

pagesRouter.get("/checkout", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/checkout.html'));
});

pagesRouter.get("/contact", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/contact.html'));
});

pagesRouter.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

pagesRouter.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/signup.html'));
});

pagesRouter.get("/cancel", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/cancellation.html'));
});

pagesRouter.get("/faq", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/FAQ.html'));
});

pagesRouter.get("/refund", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/refund.html'));
});

pagesRouter.get("/terms", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/terms.html'));
});

// FOR PRODUCTS
pagesRouter.get("/products", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/product.html'));
});

export default pagesRouter;
