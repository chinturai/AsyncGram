const express = require("express");
const app = express();
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require("cookie-parser");
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken');

app.set("view engine" , "ejs");
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.render("index");
});

app.post("/register", async (req, res) => {
  let { username, name, age, email, password } = req.body;
  let user = await userModel.findOne({email});
  if (user) return res.status(500).send("User Already Registered, Try to Login");

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password , salt, async (err, hash) => {
      if (err) throw err;
      let user =  await userModel.create({ username, email, age, name, password: hash });
      let token = jwt.sign({username: username, userid: user._id}, "secretkey123");
      res.cookie("token", token);
      res.send("Account created");
    });
  });
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/profile", isLoggedIn , async (req, res) => {
  let user = await userModel.findOne({username: req.user.username}).populate("posts");
  res.render("profile" , {user} );
});

app.get("/like/:id", isLoggedIn , async (req, res) => {
  let post = await postModel.findOne({_id: req.params.id}).populate("user");

  //Liking the post if User has not liked tilll now
  if(post.likes.indexOf(req.user.userid) === -1){
    post.likes.push(req.user.userid);
  }
  else{ //UNLiking the post if User has liked it already 
    post.likes.splice(post.likes.indexOf(req.user.userid), 1 );
  }
  
  await post.save();
  res.redirect("/profile");
});

app.get("/edit/:id", isLoggedIn , async (req, res) => {
  let post = await postModel.findOne({_id: req.params.id});

  res.render("edit", {post});
});

app.post("/update/:id", isLoggedIn , async (req, res) => {
  let post = await postModel.findOneAndUpdate({_id: req.params.id} , {content: req.body.content});
  res.redirect("/profile");
});

app.get("/delete/:id", isLoggedIn , async (req, res) => {
  let post = await postModel.findOneAndDelete({_id: req.params.id});
  let user = await userModel.findOne({username: req.user.username});
  user.posts.pull(post._id);
  await user.save();
  res.redirect("/profile");
});

app.post("/post", isLoggedIn , async (req, res) => {
  let user = await userModel.findOne({username: req.user.username});
  let {content} = req.body;
  let post = await postModel.create({
    user: user._id,
    content
  });

  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});

app.post("/login", async (req, res) => {
  let { username, password } = req.body;
  let user = await userModel.findOne({username});
  if (!user) return res.status(500).send("Something went wrong!! 😓");

  bcrypt.compare(password, user.password, (err, result) => {
    if(result){
      let token = jwt.sign({username: username, userid: user._id}, "secretkey123");
      res.cookie("token", token);
      res.status(200).redirect("/profile");
    }
    else res.redirect("/login");
  })
});

app.get("/logout", (req, res) => {
    res.cookie("token", "");
    res.redirect("/login");
});

// MiddleWare - Creating Protected routes (which can be accessed by only loggedin users)
function isLoggedIn(req , res, next){
  if(req.cookies.token === "") res.redirect("/login");
  else{
    let data = jwt.verify(req.cookies.token, "secretkey123");
    req.user = data;
    next();
  }
}

app.listen(3000);