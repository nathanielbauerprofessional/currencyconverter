const bcrypt = require("bcrypt");

function getHashedPassword(password, saltRounds) {
  const salt = bcrypt.genSaltSync(saltRounds);
  return bcrypt.hashSync(password, salt);
}

function verifyPassword(password, hashed) {
  return bcrypt.compareSync(password, hashed);
}

module.exports = { getHashedPassword, verifyPassword };
