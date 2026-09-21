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

// Login validation (test accounts: Rahul & Priya)
const loginRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

// Google auth validation — accepts credential, access_token, or code
const googleAuthRules = [
  body().custom((_, { req }) => {
    const { credential, access_token, code } = req.body;
    if (!credential && !access_token && !code) {
      throw new Error('Google credential, access_token, or authorization code is required');
    }
    return true;
  }),
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

module.exports = {
  loginRules,
  googleAuthRules,
  googleRegisterRules,
  updateProfileRules
};
