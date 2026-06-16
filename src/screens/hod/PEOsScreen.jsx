import React from "react";
import OutcomeScreen from "./OutcomeScreen.jsx";
import {
  createPEO,
  deletePEO,
  getPEOsByProgram,
  importPEOs,
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
    />
  );
};

export default PEOsScreen;
