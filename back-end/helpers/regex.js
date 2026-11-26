// Name input regex
const reName = /^(?=.{3,80}$)\p{L}+(?: \p{L}+)*$/u; // Only letters, letters with accent marks, and empty space, but only one at a time

// Standard email regex
const reEmail = /^(?=.{3,150}$)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Simple text regex (Allows only letters)
const reText = /^(?=.{1,50}$)[A-Za-zÀ-ÿ]+(?: [A-Za-zÀ-ÿ]+)*$/;

// At least one symbol, one uppercase letter, one lowercase letter, one number, minimum 8 characters and maximum of 80 characters. A combination of all the password regexes
const rePasswd =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[{\]};:'",<.>/?\\|`~])[\S]{8,80}$/;
// File containing regexes for helper functions

// CPF (11 digits) and Brazilian phone (10 or 11 digits), applied after removing non-digits
const reCPF = /^\d{11}$/;
const rePhone = /^\d{10,11}$/;

const modules = {
  reCPF,
  rePhone,
  reName,
  reEmail,
  rePasswd,
  reText,
};

module.exports = {
  modules,
};
