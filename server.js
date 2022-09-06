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

const { cronJob } = require('./email')

cronJob() // start all cronjobs

require('dotenv').config({ path: './config/.env' })

// Passport config
require('./config/passport')(passport)

connectDB()
//test
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

// get all things
app.get('/getallemails', async (req, res) => {
  const allEmails = await getAllEmails()
  if (allEmails) {
    res.send(allEmails)
  } else {
    res.status(503).send('An internal server error occured.')
  }
})

async function getAllEmails() {
  try {
    const allUsers = await User.find({}, { email: 1, _id: 1 })
    return allUsers
  } catch (err) {
    console.log('An error occurred: ')
    console.log(err)
    return null
  }
}
