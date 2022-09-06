const express = require('express')
const router = express.Router()
const authController = require('../controllers/auth') 
const homeController = require('../controllers/home')
const { ensureAuth, ensureGuest } = require('../middleware/auth')
const crypto = require('crypto') // added this so the GET functions with the token

router.get('/', homeController.getIndex)
router.get('/login', authController.getLogin)
router.post('/login', authController.postLogin)
router.get('/logout', authController.logout)
router.get('/signup', authController.getSignup)
router.post('/signup', authController.postSignup)

router.get('/forgot', authController.getForgot)
router.post('/forgot', authController.postForgot)
router.get('/reset/:token', authController.getReset)

module.exports = router