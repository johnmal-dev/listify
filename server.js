const express = require('express')
const app = express()
const mongoose = require('mongoose')
const passport = require('passport')
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)
const flash = require('express-flash')
const logger = require('morgan')
const connectDB = require('./config/database')
const mainRoutes = require('./routes/main')
const todoRoutes = require('./routes/todos')

//added new requires below for password reset functionality
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const nodemailer = require('nodemailer')
const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt-nodejs')
const async = require('async')
const crypto = require('crypto') // doesnt need to be installed as a module, this comes by default with Node.js -- used to generate random token during password reset
const User = require('./models/User') // bringing in the User constant from models to test below code

require('dotenv').config({path: './config/.env'})

// Passport config
require('./config/passport')(passport)

connectDB()

app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(logger('dev'))

// Additional Middleware added below for password reset
app.use(cookieParser())

// Sessions
app.use(
    session({
      secret: 'keyboard cat',
      resave: false,
      saveUninitialized: false,
      store: new MongoStore({ mongooseConnection: mongoose.connection }),
    })
  )
  
// Passport middleware
app.use(passport.initialize())
app.use(passport.session())

app.use(flash())
  
app.use('/', mainRoutes)
app.use('/todos', todoRoutes)
 
app.listen(process.env.PORT, ()=>{
    console.log('Server is running, you better catch it!')
})

// the below code functions, but should later be refactored to be placed in correct area for MVC architecture

app.post('/forgot', function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },

    // the below flash doesnt appear to function correctly -- it wont flash the message, although it does redirect correctly

    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          req.flash('errorforgot', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      const smtpTransport = nodemailer.createTransport({
        service: 'Zoho',
        auth: {
          user: 'listifypassreset100@gmail.com',
          pass: 'UDsQjUkGz2vq' // this is an application password, not a login password to Zoho, so we can leave it as is, or could do it via .env instead
        }
      });
      const mailOptions = {
        to: user.email,
        from: 'listifypassreset100@zohomail.com',
        subject: 'Password Reset for Listify',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
       // req.flash('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.'); // this is creating an empty red flash box, flash seems to use the 'info' part but it isnt linking to our currently established flash setup.
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});

// below code is for implementing the actual reset functionality, also needs to be 
// relocated into the proper routes/controllers but first trying to get it to function

app.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }

        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        user.save(function(err) {
          req.logIn(user, function(err) {
            done(err, user);
          });
        });
      });
    },
    // below code is erroring saying done is not a function in the smtpTransport.sendMail, it's nearly identical to above code,
    // but commenting out this functionality for now, leaving to perhaps try to fix another time

    // function(token, user, done) {
    //   const smtpTransport = nodemailer.createTransport({
    //     service: 'Zoho',
    //     auth: {
    //       user: 'listifypassreset100@gmail.com',
    //       pass: 'UDsQjUkGz2vq'
    //     }
    //   });
    //   const mailOptions = {
    //     to: user.email,
    //     from: 'listifypassreset100@zohomail.com',
    //     subject: 'Your password has been changed',
    //     text: 'Hello,\n\n' +
    //       'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
    //   };
    //   smtpTransport.sendMail(mailOptions, function(err) {
    //     req.flash('success', 'Success! Your password has been changed.');
    //     done(err);
    //   });
    // }
  ], function(err) {
    res.redirect('/');
  });
});