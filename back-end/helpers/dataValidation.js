// File with helper functions to validate data before sending it to backend
const { modules: regex } = require("./regex");

// Importing user roles
const PERMISSIONS_LIST = require("../config/rolesPermissionsList");

// Function to validate emails
const validateEmail = (email) => {
  return regex.reEmail.test(email);
};

// Function to validate dates
const validateDate = (v) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return false;
  }

  const date = new Date(`${v}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
};

// Function to validate timestamp
const validateTime = (value) => {
  if (typeof value !== "string") return false;

  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
};

// Function to validate name
const validateName = (userName) => {
  return regex.reName.test(userName);
};

// Function to validate role ID format (existence is checked in the database)
const validateRole = (role) => isPositiveInt(role);

// Positive integer ID (accepts numbers or numeric strings)
const isPositiveInt = (value) =>
  value !== null &&
  value !== "" &&
  typeof value !== "boolean" &&
  Number.isInteger(Number(value)) &&
  Number(value) > 0;

// Free text name for shifts, equipment, roles, etc. (letters, numbers and basic punctuation)
const validateLabel = (value, max = 40) =>
  typeof value === "string" &&
  value.trim().length >= 2 &&
  value.trim().length <= max &&
  /^[\p{L}\p{N}][\p{L}\p{N} ._\-/()º°#]*$/u.test(value.trim());

// Days of week: non-empty array of distinct integers 0 (Sunday) .. 6 (Saturday)
const normalizeDaysOfWeek = (value) => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 7) return null;
  const days = value.map(Number);
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return null;
  const unique = [...new Set(days)].sort((a, b) => a - b);
  return unique.length === days.length ? unique : null;
};

// Day of week (0 = Sunday) for a YYYY-MM-DD string, without timezone shifts
const weekdayOf = (isoDate) => new Date(`${isoDate}T12:00:00Z`).getUTCDay();

// Strict boolean parsing for JSON payloads
const parseBoolean = (value) => {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return null;
};

// Function to leave only numbers in functions
const trimStringNumber = (str) => {
  return str.replace(/\D/g, ""); // Returns string with only numbers
};

// Function to test CPF
const validateCPF = (cpf) => {
  // Trimming CPF (Just to be sure)
  cpf = trimStringNumber(cpf);

  // If CPF regex is valid, try to validate the CPF
  if (regex.reCPF.test(cpf)) {
    // Separating CPF
    let cpfNumbers = cpf.slice(0, 9);
    const firstDigit = Number(cpf.charAt(9));
    const secondDigit = Number(cpf.charAt(10));

    // Validating first digit
    let fstDigitValidation = 0;
    for (let i = 0; i < 9; i++) {
      fstDigitValidation += cpfNumbers[i] * (10 - i);
    }
    fstDigitValidation = (fstDigitValidation * 10) % 11;

    // If first digit is invalid, return false
    if (fstDigitValidation !== firstDigit) {
      return false;
    }

    // Validating second digit
    let scdDigitValidation = 0;
    cpfNumbers += firstDigit;
    for (let i = 0; i < 10; i++) {
      scdDigitValidation += cpfNumbers[i] * (11 - i);
    }
    scdDigitValidation = (scdDigitValidation * 10) % 11;

    // If second digit is invalid, return false
    if (scdDigitValidation !== secondDigit) {
      return false;
    }

    // If everything is correct
    return true;
  } else {
    return false;
  }
};

// Function to test phone number
const validatePhone = (phone) => {
  // Trimming phone (Just to be sure)
  phone = trimStringNumber(phone);

  return regex.rePhone.test(phone);
};

// Function to validate password
const validatePassword = (passwd) => {
  return regex.rePasswd.test(passwd);
};

// Exporting functions
module.exports = {
  validateEmail,
  validateDate,
  validateTime,
  validateName,
  validateRole,
  isPositiveInt,
  validateLabel,
  normalizeDaysOfWeek,
  weekdayOf,
  parseBoolean,
  trimStringNumber,
  validateCPF,
  validatePhone,
  validatePassword,
};
