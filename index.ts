import express from "express";
import axios, { AxiosResponse } from "axios";
import { Database } from "sqlite3";

const app = express();

const db = new Database('./tokens.db');
db.run('CREATE TABLE IF NOT EXISTS tokens(name text type UNIQUE, time timestamp)');

interface MyPair {
  token0: string;
  token1: string;
  createdAtTimestamp: number;
};

interface MyToken {
  name: string;
  time: number;
}

const query = `
{
  pairs(first: 5, orderBy: createdAtTimestamp, orderDirection: desc) {
    token0 {
      name
    }
    token1 {
      name
    }
    createdAtTimestamp
  }
}`;

const dbRead = 'SELECT Name name, Time time FROM tokens';
const dbCheck = 'SELECT Name name FROM tokens WHERE Name = ?';
const dbWrite = 'INSERT INTO tokens(name, time) VALUES ((?), (?))';

// export used for testing
export async function getDataFromAPI(): Promise<AxiosResponse> {
  return await axios.post(
    'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
    { query: query },
    { headers: { Connection: 'keep-alive' }}
  );
}

export function parseResponse(response: AxiosResponse): MyPair[] {
  const pairs = response.data.data.pairs as Array<any>;
  return pairs.map(pair => {
    const myPair: MyPair = {
      token0: pair.token0.name,
      token1: pair.token1.name,
      createdAtTimestamp: pair.createdAtTimestamp
    };
    return myPair;
  })
}

let tokensToWrite: MyToken[] = [];

function write(tokenName: string, time: number) {
  return (err: Error | null, row: any) => {
    if (err) throw err;
    if (!row) tokensToWrite.push({ name: tokenName, time });
  }
} 

function writeIfNotExists(pair: MyPair): void {
  db.serialize(() => {
    db.get(dbCheck, [pair.token0], write(pair.token0, pair.createdAtTimestamp))
      .get(dbCheck, [pair.token1], write(pair.token1, pair.createdAtTimestamp));
    for (let token of tokensToWrite) {
      db.run(dbWrite, [token.name, token.time], (err) => {
        if (err) throw err;
        tokensToWrite = tokensToWrite.filter(mT => mT.name !== token.name);
      });
    }
  })
}

function getTokens(cb: (data: MyToken[]) => void): void {
  db.all(dbRead, (err, rows) => {
    if (err) throw err;
    cb(rows.sort((a, b) => b.time - a.time));
  })
}

async function checkForNewTokens(): Promise<void> {
  const apiResponse: AxiosResponse = await getDataFromAPI();
  const pairs: MyPair[] = parseResponse(apiResponse);
  pairs.forEach((pair) => writeIfNotExists(pair));
}

let interval: NodeJS.Timeout;
checkForNewTokens();

app.set('view engine', 'ejs');
app.get("/", (req, res) => {
  if (!interval) {
    interval = setInterval(checkForNewTokens, 5000);
  }
  getTokens((tokens) => res.render('index', { tokens }));
});

app.listen(4000, () => console.log(`⚡Server is running here 👉 https://localhost:4000`));
