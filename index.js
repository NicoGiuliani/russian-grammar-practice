// index.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Add this line before your routes
app.use(express.static('public'));

app.use(cors());

// Basic test route
app.get('/', (req, res) => {
  res.send('Wiktionary Russian Declension Scraper is running.');
});

app.get('/declension', async (req, res) => {
  let { word, case: grammaticalCase, number } = req.query;

  if (!word || !grammaticalCase) {
    return res.status(400).send('Missing word or case parameter.');
  }

  word = word.toLowerCase();
  grammaticalCase = grammaticalCase.toLowerCase();

  const url = `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#Russian`;

  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    // Locate the element with id="Russian"
    const russianAnchor = $('#Russian');
    if (!russianAnchor.length) {
      return res.status(404).send('Russian section not found.');
    }

    // Find the index of that element in the full DOM tree
    const allElements = $('body').find('*').toArray();
    const anchorIndex = allElements.findIndex(el => el.attribs && el.attribs.id === 'Russian');
    let animacy = false;

    if (anchorIndex === -1) {
      return res.status(404).send('Could not locate Russian anchor in DOM.');
    }

    // Walk forward from that point, looking for a matching table
    let foundTable = null;

    for (let i = anchorIndex + 1; i < allElements.length; i++) {
      const el = allElements[i];
      const classAttr = el.attribs?.class || '';
      if (el.tagName === 'table' && classAttr.includes('inflection') && classAttr.includes('inflection-table')) {
        foundTable = $(el);
        break;
      }
    }

    if (!foundTable) {
      return res.status(404).send('No inflection table found after Russian section.');
    }

    foundTable.find('tr').each((_, row) => {
      const cells = $(row).find('td, th');
      const label = $(cells[0]).text().toLowerCase().trim();

      if (label.includes(grammaticalCase)) {
        let targetCell;

        if (grammaticalCase === 'accusative') {
          // Check for animate/inanimate split
          const hasAnimate = $(row).find('th').filter((_, th) => {
            return $(th).text().toLowerCase().includes('animate');
          }).length > 0;
          animacy = $(cells[1]).text().toLowerCase().trim();
          console.log(animacy)

          if (hasAnimate) {
            animacy = true;
            const animateIndex = number === 'plural' ? 3 : 2;
            targetCell = $(cells[animateIndex]);
          } else {
            // No animate/inanimate distinction – fallback to normal logic
            const index = number === 'plural' ? 2 : 1;
            targetCell = $(cells[index]);
          }
        } else {
          const index = number === 'plural' ? 2 : 1;
          targetCell = $(cells[index]);
        }

        const ruSpans = targetCell.find('span[lang="ru"]');
        const forms = [];

        ruSpans.each((_, span) => {
          const text = $(span).text().trim();
          if (text) forms.push(text);
        });

        result = forms.join(', ');
        return false;
      }
    });

    if (!result) {
      return res.status(404).send(`Could not find "${grammaticalCase}" row in table.`);
    }


    return res.send({ "word": word, "uppercase_number": number.charAt(0).toUpperCase() + number.slice(1), "grammaticalCase": grammaticalCase, "result": result, "hasAnimate": animacy });

  } catch (error) {
    console.error(error.message);
    return res.status(500).send('Error fetching or parsing Wiktionary.');
  }


});


app.listen(PORT, () => {
  console.log(`Server is live at http://localhost:${PORT}`);
});
