import React, { createContext, useContext, useReducer } from 'react';

const initialState = {
  identity:  null,   // { nickname, pubkey } — set on SetupScreen, persisted
  messages:  [],     // { id, from, fromId, to, toId, body, ts }[]
  peers:     [],     // { deviceId, name, connectedAt }[]
  contacts:  [],     // { nickname, pubkey }[] — added via QR scan
  router:    null,   // MeshRouter instance — set after BLE starts
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_IDENTITY':
      return { ...state, identity: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_PEERS':
      return { ...state, peers: action.payload };
    case 'ADD_CONTACT': {
      const exists = state.contacts.some(c => c.pubkey === action.payload.pubkey);
      if (exists) return state;
      return { ...state, contacts: [...state.contacts, action.payload] };
    }
    case 'SET_ROUTER':
      return { ...state, router: action.payload };
    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
