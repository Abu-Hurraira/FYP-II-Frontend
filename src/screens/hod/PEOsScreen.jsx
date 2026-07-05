import React from "react";
import OutcomeScreen from "./OutcomeScreen.jsx";
import {
  createPEO,
  deletePEO,
  getPEOsByProgram,
  importPEOs,
  restorePEOsByProgram,
  updatePEO,
} from "../../api/peosApi";

const PEOsScreen = () => {
  return (
    <OutcomeScreen
      type="PEO"
      getItems={getPEOsByProgram}
      createItem={createPEO}
      updateItem={updatePEO}
      deleteItem={deletePEO}
      importItems={importPEOs}
      restoreAllByProgram={restorePEOsByProgram}
    />
  );
};

export default PEOsScreen;
