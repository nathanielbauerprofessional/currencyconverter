const express = require("express");
const app = express();
const i18n = require("i18n");
const path = require("path");

i18n.configure({
  locales: ["en", "es", "de"], 
  directory: path.join(__dirname, "locales"),
  defaultLocale: "en", 
  objectNotation: true, 
  cookie: "locale", 
  logWarnFn: function (msg) {
    console.warn("WARN:", msg); 
  },
  logErrorFn: function (msg) {
    console.error("ERROR:", msg); 
  },
});

app.use(i18n.init);
require("dotenv").config();

const { getHashedPassword, verifyPassword } = require("./login");
const {
  checkUsernameFound,
  addUserPassToDatabase,
  checkIfUserIsAdmin,
  getAllUsers,
} = require("./database");
// const { generateSecretKey, generateQRCode, verify2FA } = require("./2fa"); 

const session = require("express-session");

app.use(
  session({
    secret: process.env.SESSION_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 60 * 1000 },
  })
);

app.use((req, res, next) => {
  try {
    res.locals.title = "Currency Converter"; 
    res.locals.locale = req.getLocale ? req.getLocale() : "en"; 
    res.locals.user = req.session.user || null; 
    res.locals.__ = req.__ || ((key) => key); 
    next();
  } catch (error) {
    console.error("Error in middleware:", error.message);
    res.locals.locale = "en";
    next();
  }
});

const portNumber = process.argv[2] || 5000;

app.set("view engine", "ejs");
app.set("views", "./templates");

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use(express.json());

app.use((req, res, next) => {
  if (req.query.lang) {
    res.cookie("locale", req.query.lang);
    req.setLocale(req.query.lang);
  }
  next();
});


const routes = {
  current_all: (fromCurrency) =>
    `https://api.freecurrencyapi.com/v1/latest?apikey=${process.env.API_KEY}&base_currency=${fromCurrency}`,
  current_one: (fromCurrency, toCurrency) =>
    `https://api.freecurrencyapi.com/v1/latest?apikey=${process.env.API_KEY}&base_currency=${fromCurrency}&currencies=${toCurrency}`,
  historical_all: (date, fromCurrency) =>
    `https://api.freecurrencyapi.com/v1/historical?apikey=${process.env.API_KEY}&date=${date}&base_currency=${fromCurrency}`,
  historical_one: (date, fromCurrency, toCurrency) =>
    `https://api.freecurrencyapi.com/v1/historical?apikey=${process.env.API_KEY}&date=${date}&base_currency=${fromCurrency}&currencies=${toCurrency}`,
};

function getRoute(data) {
  if (data.today) {
    return data.toCurrency === "All"
      ? routes.current_all(data.fromCurrency)
      : routes.current_one(data.fromCurrency, data.toCurrency);
  } else {
    return data.toCurrency === "All"
      ? routes.historical_all(data.date, data.fromCurrency)
      : routes.historical_one(data.date, data.fromCurrency, data.toCurrency);
  }
}

function createData(req) {
  const today = req.body.today === "on";
  const date = today
    ? `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`
    : req.body.date;

  return {
    today,
    amount: req.body.amount,
    fromCurrency: req.body.fromCurrency.substring(0, 3),
    toCurrency: req.body.toCurrency.substring(0, 3),
    date,
  };
}

// Routes
app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/home");
  }
  res.render("login", { port: portNumber, error: "" });
});

app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/home");
  }
  res.render("login", { port: portNumber, error: "" });
});

app.get("/register", (req, res) => {
  if (req.session.user) {
    return res.redirect("/home");
  }
  res.render("register", { port: portNumber });
});

app.get("/home", ensureAuthenticated, async (req, res) => {
  const availCurrencies = await getAllAvailableCurrencies();
  const availCurrencyTable = generateTable(availCurrencies);
  res.render("home", { port: portNumber, availCurrencyTable });
});

app.get("/cc", ensureAuthenticated, async (req, res) => {
  const availCurrencies = await getAllAvailableCurrencies();
  const availCurrencyDataList = generateDataList(availCurrencies);
  res.render("cc", { port: portNumber, availCurrencyDataList });
});

/*
app.get("/2fa", ensureAuthenticated, (req, res) => {
  if (!req.session.require2FA) return res.redirect("/home"); 
  res.render("2fa", { port: portNumber, error: "" });
});

app.get("/2fa/setup", ensureAuthenticated, async (req, res) => {
});
*/

app.get("/admin", ensureAdmin, (req, res) => {
  res.render("admin", { username: req.session.user.username });
});

app.get("/admin/users", ensureAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.render("admin-users", { users, port: portNumber });
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).send("Internal server error.");
  }
});

app.post("/cc", ensureAuthenticated, async (req, res) => {
  const data = createData(req);
  const url = getRoute(data);
  try {
    const response = await fetch(url);
    const jsonResponse = await response.json();
    const currencyObject = data.today
      ? jsonResponse.data
      : Object.values(jsonResponse.data)[0];
    const table = generateConversionTable(currencyObject, data);
    res.render("converted", { port: portNumber, table });
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).send("Error processing your request.");
  }
});

app.post("/register", async (req, res) => {
  if (req.session.user) {
    return res.redirect("/home");
  }
  const enteredUserName = req.body.username;
  const enteredPassword = req.body.password;
  const check = await checkUsernameFound(enteredUserName);
  if (check !== null) {
    res.render("login", { port: portNumber, error: "" });
    return;
  }
  const hashedPassword = getHashedPassword(enteredPassword, 12);
  const user = {
    username: enteredUserName,
    password: hashedPassword,
    admin: false,
  }; 
  await addUserPassToDatabase(user);
  req.session.user = { username: enteredUserName }; 
  res.redirect("/home");
});

app.post("/login", async (req, res) => {
  if (req.session.user) {
    return res.redirect("/home");
  }
  const enteredUserName = req.body.username;
  const enteredPassword = req.body.password;
  const check = await checkUsernameFound(enteredUserName);
  if (check === null) {
    res.redirect("/register");
    return;
  }
  const verify = verifyPassword(enteredPassword, check.password);
  if (verify) {
    req.session.user = { username: enteredUserName };
    return res.redirect("/home"); 
  } else {
    res.render("login", { port: portNumber, error: "Incorrect password. Please try again." });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("/home"); 
    }
    res.clearCookie("connect.sid"); 
    res.redirect("/login");
  });
});


async function getAllAvailableCurrencies() {
  try {
    const response = await fetch(
      `https://api.freecurrencyapi.com/v1/currencies?apikey=${process.env.API_KEY}`
    );
    if (!response.ok) throw new Error(`Response status: ${response.status}`);
    const currencyJson = await response.json();
    return Object.values(currencyJson.data).map((currency) => ({
      code: currency.code,
      name: currency.name,
    }));
  } catch (error) {
    console.error(error.message);
    return [];
  }
}

function generateTable(availCurrencies) {
  return `
    <table>
      <thead>
        <tr>
          <th>Code</th>
          <th>Name</th>
        </tr>
      </thead>
      <tbody>
        ${availCurrencies
          .map(
            (currency) =>
              `<tr><td>${currency.code}</td><td>${currency.name}</td></tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function generateDataList(availCurrencies) {
  return availCurrencies
    .map(
      (currency) => `<option value="${currency.code} - ${currency.name}"></option>`
    )
    .join("");
}

function generateConversionTable(currencyObject, data) {
  const entries = Object.entries(currencyObject);
  return `
    <table>
      <thead>
        <tr>
          <th>Amount</th>
          <th>From</th>
          <th>To</th>
          <th>Date</th>
          <th>Exchange Rate</th>
          <th>Converted Amount</th>
        </tr>
      </thead>
      <tbody>
        ${entries
          .map(
            ([currency, rate]) =>
              `<tr>
                <td>${data.amount}</td>
                <td>${data.fromCurrency}</td>
                <td>${currency}</td>
                <td>${data.date}</td>
                <td>${Number(rate.toFixed(3)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                <td>${Number((data.amount * rate).toFixed(2)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
              </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function ensureAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  }

  if (req.method === "GET") {
    return res.redirect("/login");
  }
  res.status(401).json({ error: "Unauthorized access. Please log in." });
}

async function ensureAdmin(req, res, next) {
  try {
    if (!req.session.user) {
      return res.status(401).send("Unauthorized. Please log in.");
    }

    const check = await checkIfUserIsAdmin(req.session.user.username);
    if (check) {
      return next(); 
    }

    return res.status(403).send("Access denied. Admins only.");
  } catch (error) {
    console.error("Error checking admin status:", error.message);
    res.status(500).send("Internal server error.");
  }
}

app.listen(portNumber, () => {
  console.log(`Currency Converter running at http://localhost:${portNumber}`);
});
