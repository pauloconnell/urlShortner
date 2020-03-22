var express = require("express");
var mongo = require("mongodb");
var mongoose = require("mongoose");
var app = express();
var cors = require("cors");
var dns = require("dns");
var bodyParser = require("body-parser");

// Basic Configuration set to env or default localHost:3000
var port = process.env.PORT || 3000;

//add db

mongoose.connect(process.env.DB_URI); // can add || local host
const urlSchema = new mongoose.Schema(
  {
    originalURL: String,
    shortenedURL: String
  },
  { timestamps: true }
);
const urlModel = mongoose.model("Url", urlSchema);
//needed if we define in seperate file: module.exports= urlModel;
console.log(mongoose.connection.readyState);
app.use(cors());
app.use(bodyParser()); // instead of sending querry data for all to see in the url,
//  mount the body-parser to parse the securly sent POST bodies :
// support parsing of application/json type post data
app.use(bodyParser.json());

//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({ extended: true }));

//add static file - style.css
app.use("/public", express.static(process.cwd() + "/public"));
//serve our html page at root get
app.get("/", function(req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
}); // process.cwd() is the 'current' directory-ie.cloud based
// where _dirname is the directory where .js is stored
//_dirname is variable for locally stored base directory only

app.get("/api/hello", function(req, res) {
  res.json({ greeting: "hello from my API" });
});

app.get("/api/shorturl", function(req, res) {
  console.log(mongoose.connection.readyState + "is connection State");
  res.json({ greeting: "please enter a url or send POST req" });
});

app.use("/api/shorturl/:new", async function(req, res) {
  // set name in input field of index.html  <input name="setMe">
  // then usebody parser req.body.setMe to get our input field securly embeded in post body

  let forwardedUrl = req.body.urlToForward;
  console.log("good at line 68..." + forwardedUrl);
  let urlIsFound = false;
  let ourNewUrl = "";
  let debugUrl = "";
  // determine if our input is a shortURL(ie is #) or a URL
  if (isNaN(forwardedUrl)) {
    // if it is a URL :
    console.log(forwardedUrl + "is NaN begins with: " + forwardedUrl.charAt(0));
    // first  using regex below TO REMOVE http(s) and WWW.
    let expression1 = new RegExp("/w{5}://w{3}./"); // use regex to delete https://
    let expression2 = new RegExp("/w{4}://w{3}./"); // use regex to delete http://
    let didItFormat = false;
    let invalidInput = false;
    if (forwardedUrl.charAt(0) == "h" || "H") {
      if (forwardedUrl.charAt(4) == "s" || "S") {
        // if url is http(s)...remove https://www. to format for DNS check
        ourNewUrl = forwardedUrl.replace(expression1, "");
      } else {
        // remove http://www. with our expressions above expression2 below
        ourNewUrl = forwardedUrl.replace(/\w{4}:\/\/w{3}\./, "");
      }
      didItFormat = true;
    }
    if (forwardedUrl.charAt(0) == "w" || "W") {
      // remove www.
      console.log("should format to remove www here");
      ourNewUrl = forwardedUrl.replace(/w{3}\./, "");
      didItFormat = true;
    }
    if (forwardedUrl.charAt(0) == "//") {
      // if url starts with //, then remove //
      ourNewUrl = forwardedUrl.replace(/\/\//, "");
      didItFormat = true;
    }
    console.log(ourNewUrl + "will be parsed, was it formatted? " + didItFormat);
    const url = require("url"); // parse the URL first then use url.host
    try {
      debugUrl = new URL("http://" + ourNewUrl);
      console.log("our url is " + debugUrl);
    } catch {
      res.send("invalid Url : " + forwardedUrl + "failed URL formatting");
    }
    var dns = require("dns");
    var dnsCheck = dns.lookup(debugUrl.host, function(err, addresses, family) {
      if (err) {
        return res.json({ error: "dns returned invalid URL" + forwardedUrl });
      }
      console.log(addresses + "returned by successful dnsCheck");
      if (!addresses) {
        return res.json({ error: "URL failed dns check" + forwardedUrl });
      }
    });
    console.log("dns returned" + dnsCheck);
    // lookup url in our database to see if it's there already
    await urlModel
      .findOne({ originalURL: forwardedUrl })
      .exec()
      .then(docs => {
        // if we find this url in our database:
        if (docs) {
          urlIsFound = true;
          console.log("found isNan doc in database existing short url" + docs);
          res.json({
            original_url: forwardedUrl,
            short_url: docs.shortenedURL
          });
        }
      })
      .catch(err => {
        console.log("error :" + err);
      });
    if (!urlIsFound) {
      // unique URL so create our Short URl to save
      let shortUrl = Math.floor(Math.random() * 100000).toString();
      // ensure our random number shortUrl isn't used:
      let needUniqueShort = true;
      while (needUniqueShort) {
        //let shortUrlIsUnique = false;
        await urlModel
          .findOne({ shortenedURL: shortUrl })
          .exec()
          .then(docs => {
            if (docs) {
              // if we have used that shortURL in db already, make new one.
              shortUrl = Math.floor(Math.random() * 100000).toString();
            } else {
              //shortUrlIsUnique = true;
              needUniqueShort = false;
            }
          })
          .catch(err => {
            console.log("error :" + err);
          });
      } // end of while statement- so we have unique short url
      //save this to our db
      var storeURL = new urlModel({
        originalURL: forwardedUrl,
        shortenedURL: shortUrl
      });
      console.log(
        storeURL + "saved to database :) Original/Short URL=" + storeURL
      );
      await storeURL.save(err => {
        if (err) {
          return "error saving to data base" + err;
        } else console.log("MongoDb has Stored " + storeURL + " it's saved");
      });
      return res.json(storeURL);
    } // end of if !urlIsFound statement
  } else {
    // ie. it is a number   else corresponds to the test if isNan(forwardedUrl)
    console.log(forwardedUrl + "is a number");
    // search for this short url on our database
    await urlModel
      .findOne({ shortenedURL: forwardedUrl })
      .exec()
      .then(docs => {
        // if we have this, return the info
        if (docs) {
          urlIsFound = true;
          console.log("Found a doc with short URL " + docs.originalURL);
          let formattedUrl = docs.originalURL;
          //let ourNewUrl = formattedUrl.replace(/w{3}\./, "");
          res.redirect("http://" + formattedUrl);
        }
      })
      .catch(err => {
        res.json({ error: "error reading from database line 173" + err });
      });
  }
  console.log(urlIsFound);
  if (!urlIsFound) {
    console.log(urlIsFound + forwardedUrl + "not in database");
    console.log("No Url Registered to that number");
    res.send("error - no URL registered to that number");
  } 

  console.log("connection:" + mongoose.connection.readyState + forwardedUrl);
  // res.json({ "your short URL is": storeURL }); // json contains the shortened URL for user

  //.catch((err)=>{
  //  res.json({"error":"error reading from database"+err});
  //});
});
//app.post("/:urlToForward")
app.get("/listdb/", (req, res) => {
  urlModel
    .find()
    .exec()
    .then(docs => {
      res.json(docs);
    });
});
app.get("/listdb/:originalURL", (req, res) => {
  let originalURL = req.params.originalURL;
  //res.send(originalURL);
  urlModel
    .find({ originalURL: originalURL })
    .exec()
    .then(docs => {
      var shortList = [];
      var dbUrlKeys = Object.keys(docs);
      var listUrls = Object.values(docs).forEach(item => {
        if (item.shortenedURL) {
          console.log(item.shortenedURL);
          shortList.push(item.shortenedURL);
          //console.log(originalURL);
          // res.json(item.shortenedURL);
        }
      });
      var detailList = Object.entries(docs);
      res.json({ "Short Urls for": originalURL, are: shortList });

      //  res.send(`Original URL: ${url} shortUrl: ${short}`);
      // listUrls.push(url);
    })
    .catch(err => {
      res.json({ error: err.toString() });
      console.log(err);
    });
});
app.get("/:new", (req, res) => {
  var urlToForward = req.params.new;
  console.log(urlToForward);

  if (isNaN(urlToForward)) {
    //link to shortened url
    console.log("you have entered a " + urlToForward);
    //use regex to strip www off the front:
    let expression = "^(WWW/.|www.)"; //  *** strip off www.
    // use regex to not querry database until full address is entered
    let regex = new RegExp(expression);
    //if (regex.test(originalUrl)) {
    console.log("passed regex test");
  }
  urlModel
    .findOne({ shortenedURL: urlToForward })
    .exec()
    .then(data => {
      console.log(data.originalURL + "Is current URL");

      // let a = data.forEach((doc)=>{
      //    return doc;
      //  });
      console.log("we will forward:" + urlToForward);
      res.redirect("http://" + data.originalURL);
      //res.status(301).redirect("https:/"+data.originalURL); //.originalURL)
      //res.send(data.originalURL);
    })
    .catch(err => {
      res.json({ error: "error reading from database" + err });
    });
});

//post and get handeled above by app.use
//app.post("/api/shorturl/:new", function(req, res) {
//if (req.params){
//let original_url=req.params;
//look up what number is next in database
//save the url in the database
//send back new short url
//let shortUrl=

//the idea below was to set up an endpoint using variable name based on input
//app.get(`/{shortUrl}`, function(req, res){
// look up short URL in database
// res.json({ ShortURL : "posted"});

//}
//   });

console.log("finished");

app.listen(port, function() {
  console.log("Node.js listening ...");
});
