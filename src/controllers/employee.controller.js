const { pgController } = require(".");

module.exports = {
  createPG: pgController.createPG,
  getPGs: pgController.getPGs,
  getPG: pgController.getPG,
  updatePG: pgController.updatePG,
  deletePG: pgController.deletePG,
};
