import React, { createContext, useContext, useReducer } from 'react';

const initialState = {
  identity:      null,   // { nickname, pubkey }
  messages:      [],     // { id, from, fromId, to, toId, body, type, ts }[]
  peers:         [],     // { deviceId, name, connectedAt }[]
  contacts:      [],     // { nickname, pubkey }[]
  router:        null,   // MeshRouter instance
  crypto:        null,   // RealCrypto (or NullCrypto) instance
  meetingPoints: [],     // { id, contactPubkey, contactNickname, meetLat, meetLng, arrived }[]
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
    case 'SET_ROUTER':
      return { ...state, router: action.payload };
    case 'SET_CRYPTO':
      return { ...state, crypto: action.payload };
    case 'ADD_MEETING_POINT': {
      const exists = state.meetingPoints.some(mp => mp.id === action.payload.id);
      if (exists) return state;
      return { ...state, meetingPoints: [...state.meetingPoints, action.payload] };
    }
    case 'MARK_ARRIVED':
      return {
        ...state,
        meetingPoints: state.meetingPoints.map(mp =>
          mp.id === action.payload ? { ...mp, arrived: true } : mp
        ),
      };
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
