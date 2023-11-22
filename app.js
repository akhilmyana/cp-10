const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running");
    });
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
};

initializeDbAndServer();

const returnObj = (eachRes) => {
  return {
    stateId: eachRes.state_id,
    stateName: eachRes.state_name,
    population: eachRes.population,
  };
};

const authToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserDetails = `
    SELECT
      *
    FROM    
      user
    WHERE
      username = '${username}'`;
  const dbUser = await db.get(getUserDetails);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPwdMatch = await bcrypt.compare(password, dbUser.password);
    if (isPwdMatch) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authToken, async (request, response) => {
  const getStates = `
    SELECT 
      *
    FROM
      state;`;
  const stateArray = await db.all(getStates);
  response.send(stateArray.map((eachRes) => returnObj(eachRes)));
});

app.get("/states/:stateId/", authToken, async (request, response) => {
  const { stateId } = request.params;
  const getState = `
    SELECT
      *
    FROM
      state
    WHERE
      state_id = ${stateId}`;

  const stateRes = await db.get(getState);
  response.send(returnObj(stateRes));
});

app.post("/districts/", authToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrict = `
    INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
    VALUES('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})`;

  const newData = await db.run(createDistrict);
  response.send("District Successfully Added");
});

app.get("/districts/:districtId/", authToken, async (request, response) => {
  const { districtId } = request.params;
  const getDistrict = `
    SELECT * FROM district WHERE district_id = ${districtId}`;

  const District = await db.get(getDistrict);
  response.send({
    districtId: District.district_id,
    districtName: District.district_name,
    stateId: District.state_id,
    cases: District.cases,
    active: District.active,
    deaths: District.deaths,
  });
});

app.delete("/districts/:districtId/", authToken, async (request, response) => {
  const { districtId } = request.params;
  const delQuery = `
    DELETE FROM district WHERE district_id = ${districtId}`;

  const deletedQuery = await db.run(delQuery);
  response.send("District Removed");
});

app.put("/districts/:districtId/", authToken, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDetails = `
    UPDATE district
    SET
      district_name = '${districtName}',
      state_id = ${stateId},
      cases = ${cases},
      cured = ${cured},
      active = ${active},
      deaths = ${deaths}
      `;
  const updatedData = await db.run(updateDetails);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats/", authToken, async (request, response) => {
  const { stateId } = request.params;
  const getStats = `
    SELECT SUM(cases), SUM(cured), SUM(active), SUM(Deaths)
    FROM district WHERE state_id = ${stateId};`;

  const stats = await db.get(getStats);
  response.send({
    totalCases: stats["SUM(cases)"],
    totalCured: stats["SUM(cured)"],
    totalActive: stats["SUM(active)"],
    totalDeaths: stats["SUM(Deaths)"],
  });
});

module.exports = app;
