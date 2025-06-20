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
  let { word, case: grammaticalCase } = req.query;
  const number = req.query.number?.toLowerCase() || 'singular';

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
        const index = number === 'plural' ? 2 : 1; // 1st <td> is singular, 2nd is plural
        const targetCell = $(cells[index]);
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


    return res.send({ "word": word, "uppercase_number": number.charAt(0).toUpperCase() + number.slice(1), "grammaticalCase": grammaticalCase, "result": result });

    // // backup
    // return res.send(`
    //   <h2>Result for: ${word}</h2>
    //   <p><strong>Case:</strong> ${grammaticalCase}</p>
    //   <p><strong>${number.charAt(0).toUpperCase() + number.slice(1)} Form:</strong> ${result}</p>
    // `);

  } catch (error) {
    console.error(error.message);
    return res.status(500).send('Error fetching or parsing Wiktionary.');
  }


});


app.listen(PORT, () => {
  console.log(`Server is live at http://localhost:${PORT}`);
});
