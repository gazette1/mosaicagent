/**
 * Storage Module - Deal folder I/O operations
 */

export {
  generateDealId,
  getDealPath,
  getDealJsonPath,
  getInputsPath,
  getOutputsPath,
  dealExists,
  createDeal,
  loadDeal,
  saveDeal,
  copySourceFile,
  addSource,
  writeOutput,
  writeJsonOutput,
  writeCsvOutput,
  listDeals,
  readSourceFile,
  writeModelCsv,
  writeSensitivityCsv,
  storage
} from './deal-storage';
