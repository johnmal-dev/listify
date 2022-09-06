const passport = require('passport')
const validator = require('validator')
const User = require('../models/User')

//added new requires below for password reset functionality
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const nodemailer = require('nodemailer')
const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt-nodejs')
const async = require('async')
const crypto = require('crypto') // doesnt need to be installed as a module, this comes by default with Node.js -- used to generate random token during password reset

 exports.getLogin = (req, res) => {
    if (req.user) {
      return res.redirect('/todos')
    }
    res.render('login', {
      title: 'Login'
    })
  }
  
  exports.postLogin = (req, res, next) => {
    const validationErrors = []
    if (!validator.isEmail(req.body.email)) validationErrors.push({ msg: 'Please enter a valid email address.' })
    if (validator.isEmpty(req.body.password)) validationErrors.push({ msg: 'Password cannot be blank.' })
  
    if (validationErrors.length) {
      req.flash('errors', validationErrors)
      return res.redirect('/login')
    }
    req.body.email = validator.normalizeEmail(req.body.email, { gmail_remove_dots: false })
  
    passport.authenticate('local', (err, user, info) => {
      if (err) { return next(err) }
      if (!user) {
        req.flash('errors', info)
        return res.redirect('/login')
      }
      req.logIn(user, (err) => {
        if (err) { return next(err) }
        req.flash('success', { msg: 'Success! You are logged in.' })
        res.redirect(req.session.returnTo || '/todos')
      })
    })(req, res, next)
  }
  
  exports.logout = (req, res) => {
    req.logout(() => {
      console.log('User has logged out.')
    })
    req.session.destroy((err) => {
      if (err) console.log('Error : Failed to destroy the session during logout.', err)
      req.user = null
      res.redirect('/')
    })
  }
  
  exports.getSignup = (req, res) => {
    if (req.user) {
      return res.redirect('/todos')
    }
    res.render('signup', {
      title: 'Create Account'
    })
  }
// added new controller for forgot below
  exports.getForgot = (req, res) => {
    res.render('forgot', {
      title: 'Forgot',
      user: req.user
    })
  }

// added new controller for reset below
exports.getReset = (req, res) => {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('reset', {
      user: req.user
    });
  });
};
  
  exports.postSignup = (req, res, next) => {
    const validationErrors = []
    if (!validator.isEmail(req.body.email)) validationErrors.push({ msg: 'Please enter a valid email address.' })
    if (!validator.isLength(req.body.password, { min: 8 })) validationErrors.push({ msg: 'Password must be at least 8 characters long' })
    if (req.body.password !== req.body.confirmPassword) validationErrors.push({ msg: 'Passwords do not match' })
  
    if (validationErrors.length) {
      req.flash('errors', validationErrors)
      return res.redirect('../signup')
    }
    req.body.email = validator.normalizeEmail(req.body.email, { gmail_remove_dots: false })
  
    const user = new User({
      userName: req.body.userName,
      email: req.body.email,
      password: req.body.password
    })
  
    User.findOne({$or: [
      {email: req.body.email},
      {userName: req.body.userName}
    ]}, (err, existingUser) => {
      if (err) { return next(err) }
      if (existingUser) {
        req.flash('errors', { msg: 'Account with that email address or username already exists.' })
        return res.redirect('../signup')
      }
      user.save((err) => {
        if (err) { return next(err) }
        req.logIn(user, (err) => {
          if (err) {
            return next(err)
          }
          res.redirect('/todos')
        })
      })
    })
  }

  exports.postForgot = (req, res, next) => {
    async.waterfall(
      [
        function (done) {
          crypto.randomBytes(20, function (err, buf) {
            var token = buf.toString('hex')
            done(err, token)
          })
        },
  
        // the below flash doesnt appear to function correctly -- it wont flash the message, although it does redirect correctly
  
        function (token, done) {
          User.findOne({ email: req.body.email }, function (err, user) {
            if (!user) {
              req.flash(
                'errorforgot',
                'No account with that email address exists.'
              )
              return res.redirect('/forgot')
            }
  
            user.resetPasswordToken = token
            user.resetPasswordExpires = Date.now() + 3600000 // 1 hour
  
            user.save(function (err) {
              done(err, token, user)
            })
          })
        },
        function (token, user, done) {
          const smtpTransport = nodemailer.createTransport({
            service: 'Zoho',
            auth: {
              user: 'listifypassreset100@gmail.com',
              pass: 'UDsQjUkGz2vq', // this is an application password, not a login password to Zoho, so we can leave it as is, or could do it via .env instead
            },
          })
          const mailOptions = {
            to: user.email,
            from: 'listifypassreset100@zohomail.com',
            subject: 'Password Reset for Listify',
            text:
              'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
              'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
              'http://' +
              req.headers.host +
              '/reset/' +
              token +
              '\n\n' +
              'If you did not request this, please ignore this email and your password will remain unchanged.\n',
          }
          smtpTransport.sendMail(mailOptions, function (err) {
            // req.flash('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.'); // this is creating an empty red flash box, flash seems to use the 'info' part but it isnt linking to our currently established flash setup.
            done(err, 'done')
          })
        },
      ],
      function (err) {
        if (err) return next(err)
        res.redirect('/forgot')
      }
    )
  }