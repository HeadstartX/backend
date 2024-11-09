const connectToMongo = require("./connections");
const express = require("express");
var cors = require("cors");
const User = require("./models/User");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const puppeteer = require("puppeteer");

connectToMongo();
const app = express();
const port = 8000;

app.use(express.json());
app.use(cors());

const genAI = new GoogleGenerativeAI("AIzaSyDA81TLlcAGD2dUoVULTgrF64OXFBi4Sqo");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const jwt_secret = "88465123";

app.post(
  "/signup",
  [body("email", "Enter a valid email").isEmail()],
  async (req, res) => {
    let success = false;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success, errors: errors.array() });
    }
    try {
      let user = await User.findOne({ email: req.body.email });
      if (user) {
        return res
          .status(400)
          .json({ success, error: "This email already exist" });
      }
      const salt = await bcrypt.genSalt(10);
      const safepass = await bcrypt.hash(req.body.password, salt);

      user = await User.create({
        name: req.body.name,
        email: req.body.email,
        password: safepass,
        number: req.body.number,
      });

      const data = {
        user: {
          id: user.id,
        },
      };
      const authtoken = jwt.sign(data, jwt_secret);
      success = true;
      res.status(200).json({ success, authtoken, data });
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Some Error occurred");
    }
  }
);
app.post(
  "/login",
  [
    body("email", "Enter a valid email").isEmail(),
    body("password", "Password cannot be blank").exists(),
  ],
  async (req, res) => {
    let success = false;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    console.log(email);
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res
          .status(400)
          .json({ success, error: "Please enter correct email" });
      }

      const passwordcheck = await bcrypt.compare(password, user.password);
      if (!passwordcheck) {
        return res
          .status(401)
          .send({ success, error: "Please enter correct password" });
      }

      const data = {
        user: {
          id: user.id,
        },
      };
      const authtoken = jwt.sign(data, jwt_secret);
      success = true;
      res.status(200).json({ success, authtoken, data });
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Some Error occurred");
    }
  }
);

app.get("/getUserByUserId", async (req, res) => {
  const { userId } = req.query;

  console.log(userId);

  if (!userId) {
    return res.status(400).json({ message: "UserId is required!" });
  }

  const user = await User.findOne({ _id: userId }).select("-password");

  if (!user) {
    return res.status(400).json({ message: "User not found!" });
  }

  return res.send(user);
});

app.post("/update-details", async (req, res) => {
  const {
    name,
    about,
    experience,
    socials,
    startupName,
    idea,
    userId,
    startupLogo,
    websiteLink,
  } = req.body;

  try {
    const user = await User.findOne({ _id: userId }).select("-password");

    if (!user) {
      return res.status(404).send({ message: "User doesn't exist" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      {
        name,
        about,
        experience,
        socials,
        startupName,
        idea,
        websiteLink,
        startupLogo,
      },
      { new: true }
    ).select("-password");

    res.send(updatedUser);
  } catch (error) {
    res.status(500).send({ message: "An error occurred", error });
  }
});

app.post("/get-essentials", async (req, res) => {
  const { userId } = req.body;

  const user = await User.findOne({ _id: userId });

  if (!user) {
    return res.status(400).json({ message: "User doesn't exist!" });
  }

  const idea = user.idea;
  const name = user.name;
  const about = user.about;
  const experience = user.experience.join(",");

  let businessPrompt = `I am gonna provide you with a startup idea and for this idea I need you to generate an in depth business strategy, including telling about potenial & need of this, market, market size, pricing strategy & expected revenue. Idea: ${idea}`;

  const businessResult = await model.generateContent(businessPrompt);
  const businessResponse = businessResult.response;

  let fundingPrompt = `I am gonna provide you with a startup idea and for this idea I need you to generate an in depth analysis of funding requirements, including but not limited to telling about how much funding should they go for, where should they get that and just generally guide them. Idea: ${idea}`;

  const fundingResult = await model.generateContent(fundingPrompt);
  const fundingResponse = fundingResult.response;

  let marketingPrompt = `I am gonna provide you with a startup idea and for this idea I need you to generate marketing strategy, including but not limited to telling about their market, market size, marketing strategies like platforms they can target, what is their likely target audience, ideas about posts etc.. Idea: ${idea}`;

  const marketingResult = await model.generateContent(marketingPrompt);
  const marketingResponse = marketingResult.response;

  let roastPrompt = `I am gonna provide you with a startup idea and for this idea I need you to roast it sort of in a tough love way so that they understand the shortcomings of the ideas. Idea: ${idea}`;

  const roastResult = await model.generateContent(roastPrompt);
  const roastResponse = roastResult.response;

  let mailPrompt = `I am gonna provide you with a startup idea and for this idea I need you to generate a mail to investors introducing the founder, explaining the startup idea and asking for funds, you may calculate amount of funds needed yourself. Founder's name: ${name}, About Founder: ${about}, Experience: ${experience}  Idea: ${idea}`;

  const mailResult = await model.generateContent(mailPrompt);
  const mailResponse = mailResult.response;

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId },
    {
      businessStrategy: businessResponse.text(),
      fundingRequirements: fundingResponse.text(),
      marketingStrategy: marketingResponse.text(),
      ideaRoast: roastResponse.text(),
      basicFundingEmail: mailResponse.text(),
    },
    { new: true }
  ).select("-password");

  return res.send(updatedUser);
});

// to generate posts
app.post("/generate-posts", async (req, res) => {
  const { userId } = req.body;

  const user = await User.findOne({ _id: userId }).select("-password");

  if (!user) {
    return res.status(400).json({ message: "User doesn't exist." });
  }

  const idea = user.idea;
  const startupName = user.startupName;

  const query = `I am gonna provide you with a startup idea and for marketing of it, I need you to generate 3 professional marketing posts for that idea, and don't give posts any heading and make sure to separate each post by ++. Startup name: ${startupName}. Idea: ${idea}`;

  const result = await model.generateContent(query);
  const response = result.response;

  console.log(response.text());

  const posts = response.text().split("++");

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId },
    { posts: posts, lastPostDate: new Date() },
    { new: true }
  ).select("-password");

  return res.status(200).json(updatedUser);
});

// to update cold email templates
app.post("/update-email-template", async (req, res) => {
  const { userId, to, subject, body } = req.body;

  const user = await User.findOne({ _id: userId }).select("-password");

  if (!user) {
    return res.status(400).json({ message: "User doesn't exist." });
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId },
    {
      $push: {
        fundingEmails: { to, subject, body },
      },
    },
    { new: true }
  ).select("-password");

  return res.status(200).json(updatedUser);
});

app.post("/competitor-analysis", async (req, res) => {
  const { userId } = req.body;
  let browser = null;

  const user = await User.findOne({ _id: userId }).select("-password");

  if (!user) {
    return res.status(400).json({ message: "User doesn't exist." });
  }

  // const idea = user.idea;
  const idea = "An app to generate qr codes which let’s people ‘check in’ by scanning it."

  const query = `I am gonna provide you with a startup idea and for that I need you to just generate one sentence comprising of 3-4 keywords that I can search on google and get an idea of the competitors. No quotation marks. Idea: ${idea}`;

  const result = await model.generateContent(query);
  const response = result.response;

  const q = response.text();
  const url = `https://www.google.com/search?q=${q}`;
  browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setViewport({ width: 1280, height: 800 });

  page.setDefaultNavigationTimeout(30000);

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const blockedResourceTypes = ["image", "font", "stylesheet"];
    if (blockedResourceTypes.includes(request.resourceType())) {
      request.abort();
    } else {
      request.continue();
    }
  });

  await page.goto(url, { waitUntil: "networkidle0" });

  const scrapedData = await page.evaluate(() => {
    const results = [];

    const titles = document.getElementsByClassName('LC20lb MBeuO DKV0Md');
    const descriptions = document.getElementsByClassName('VwiC3b yXK7lf lVm3ye r025kc hJNv6b Hdw6tb');

    for (let i = 0; i < titles.length; i++) {
      const titleElement = titles[i];
      const title = titleElement.textContent.trim();
      
      const link = titleElement.closest('a')?.href || '';

      const description = descriptions[i]?.textContent.trim();
      if (title && description && link) {
        results.push({ title, description, link });
      }
    }

    return results;
  });

  const enhancedData = [];
  let i = 0;
  for (let data of scrapedData) {
      try {
        const competitorPage = await browser.newPage();
        await competitorPage.goto(data.link, { waitUntil: "domcontentloaded" });
  
        const pageContent = await competitorPage.evaluate(() => {
          return document.body.innerText;
        });
  
        enhancedData.push({
          title: data.title,
          description: `${data.description}\n\n${pageContent.slice(250, 2500)}`,
          link: data.link
        });
  
        await competitorPage.close();
      } catch (error) {
        console.error(`Failed to scrape ${data.link}:`, error);
        enhancedData.push(data);
      }
  }

  await browser.close();

  const compQuery = `I am gonna provide you with a startup idea, and an array of information on the competitors, I need you to make sense of the array and provide a competitor analysis. DO NOT mention anything about the array, just provide the COMPETITOR ANALYSIS OF THE STARUP AND NOTHING ELSE, please. Thank you. Startup idea: ${idea}. Competitor's Array: ${JSON.stringify(enhancedData.slice(0, 10))}`;

  const compResult = await model.generateContent(compQuery);
  const compResponse = compResult.response;

  console.log(compResponse.text());

  const updatedUser = await User.findOneAndUpdate(
    {_id: userId},
    {
      competitors: compResponse.text(),
      scrapedResearch: scrapedData
    },
    {new: true}
  ).select("-password")

  res.status(200).json(updatedUser)
});

app.get("/", (req, res) => {
  res.send("Hi!");
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});