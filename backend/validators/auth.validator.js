// backend/validators/auth.validator.js
const { body, validationResult } = require('express-validator');

// Middleware to check validation results and return errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array()
    });
  }
  next();
};

// Registration validation
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').trim().isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
    .matches(/\d/).withMessage('Password must contain at least one number'),
  body('role').optional().isIn(['client', 'lawyer']).withMessage('Role must be client or lawyer'),
  validate
];

// Login validation
const loginRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

// OTP verification validation
const verifyOTPRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must contain only numbers'),
  validate
];

// Google auth validation
const googleAuthRules = [
  body('credential').notEmpty().withMessage('Google credential is required'),
  validate
];

// Google register validation
const googleRegisterRules = [
  body('googleId').notEmpty().withMessage('Google ID is required'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('role').isIn(['client', 'lawyer']).withMessage('Role must be client or lawyer'),
  validate
];

// Profile update validation
const updateProfileRules = [
  body('bio').optional().isLength({ max: 1000 }).withMessage('Bio must be under 1000 characters'),
  body('yearsOfExperience').optional().isInt({ min: 0, max: 70 }).withMessage('Years must be 0-70'),
  body('feePerHour').optional().isFloat({ min: 0, max: 100000 }).withMessage('Fee must be 0-100000'),
  body('practiceAreas').optional().isArray().withMessage('Practice areas must be an array'),
  validate
];

// Forgot password validation
const forgotPasswordRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  validate
];

// Reset password validation
const resetPasswordRules = [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
    .matches(/\d/).withMessage('Password must contain at least one number'),
  validate
];

module.exports = {
  registerRules,
  loginRules,
  verifyOTPRules,
  googleAuthRules,
  googleRegisterRules,
  updateProfileRules,
  forgotPasswordRules,
  resetPasswordRules
};
