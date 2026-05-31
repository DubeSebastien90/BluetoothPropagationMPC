import React, { createContext, useContext, useReducer } from 'react';

const initialState = {
  identity:  null,   // { nickname, pubkey }
  messages:  [],     // { id, from, fromId, to, toId, body, ts }[]
  peers:     [],     // { deviceId, name, connectedAt }[]
  contacts:  [],     // { nickname, pubkey }[]
  groups:    [],     // { groupId, name, members[{ nickname, pubkey }], createdAt }[]
  router:    null,   // MeshRouter instance
  crypto:    null,   // RealCrypto (or NullCrypto) instance
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
    case 'SET_CONTACTS':
      return { ...state, contacts: action.payload };
    case 'REMOVE_CONTACT':
      return { ...state, contacts: state.contacts.filter(c => c.pubkey !== action.payload) };
    case 'ADD_GROUP': {
      const exists = state.groups.some(g => g.groupId === action.payload.groupId);
      if (exists) return state;
      return { ...state, groups: [...state.groups, action.payload] };
    }
    case 'SET_GROUPS':
      return { ...state, groups: action.payload };
    case 'REMOVE_GROUP':
      return { ...state, groups: state.groups.filter(g => g.groupId !== action.payload) };
    case 'SET_ROUTER':
      return { ...state, router: action.payload };
    case 'SET_CRYPTO':
      return { ...state, crypto: action.payload };
    case 'RESET':
      return { ...initialState };
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
