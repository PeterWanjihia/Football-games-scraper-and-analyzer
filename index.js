const app = require("express")();
const puppeteer = require("puppeteer-extra");
const cheerio = require("cheerio");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const url = "https://www.flashscore.com";

app.get("/", async (req, res) => {
  const today_matches = [];
  const valid_matches = [];

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url);

  //expand all the blocks to see all the games
  const buttons = await page.$$(
    ".event__expanderBlock > .event__expander--close"
  );

  for (const button of buttons) {
    await button.click();
  }

  let content = await page.content();
  let $ = cheerio.load(content);

  //get all todays matches
  let games = $(".event__match");

  for (const game of games) {
    const home = $(game).find(".event__participant--home").text().trim();
    const away = $(game).find(".event__participant--away").text().trim();
    const kickoff = $(game).find(".event__time").text().trim();
    const link =
      url + "/match/" + $(game).attr("id").split("_").pop() + "/#/h2h/overall";

    today_matches.push({ home, away, kickoff, link });
  }

  console.log(today_matches.length);

  //get past results of a certain fixure
  for (const match of today_matches) {
    const results = [];

    await page.goto(match?.link);
    await page.waitForSelector(".h2h");
    const html = await page.content();
    $ = cheerio.load(html);

    const country = $(".tournamentHeader__country").text().trim().split(":")[0];
    const matches = $(
      ".container__detail > #detail > .h2hSection > .h2h > .h2h__section:not(:nth-child(3)) > .rows > .h2h__row"
    );

    //get the total goals of previous results
    for (const game of matches) {
      const goals =
        parseInt(
          $(game).find(".h2h__result > span:nth-child(1)").text().trim()
        ) +
        parseInt(
          $(game).find(".h2h__result > span:nth-child(2)").text().trim()
        );

      results.push(goals);
    }

    //validate and filter all the matches
    const hasZero = results.some((score) => score <= 1);

    if (results.length > 9 && !hasZero && match.kickoff !== "") {
      const { link, ...others } = match;
      valid_matches.push({ ...others, country });
    }
  }

  console.table(valid_matches);

  await browser.close();
});

app.listen(8000, () => {
  console.log("Running on 8000");
});

