import { configureStore } from '@reduxjs/toolkit';
import HeaderSlice from './Slices/HeaderSlice';
import { TypedUseSelectorHook, useDispatch } from 'react-redux';
// import StickySlice from './Slices/StickySlice';
// import TableSlice from './Slices/TableDataSlice';
// import ChatReducer from './Slices/ChatSlice';
// import projectSlice from './Slices/projectSlice';
// import EcommerceSlice from './Slices/E-comerceSlice';
// import filterSlice from './Slices/filterSlice';
import themeSlice from './Slices/themeCostomizer';
// import BookMarkSliceHeader from './Slices/bookmark';
// import typeAheadSlice from './Slices/TypeaheadSlice';
// import TaskSlice from './Slices/TaskReducer';
// import ToDoSlice from './Slices/TodoReducer';
// import BookMarkSlice from './Slices/BookMarkReducer';
// import ContactReducer from './Slices/ContactReducer';
// import KnowledgeBaseSlice from './Slices/KnowledgeBaseSlice';
// import EmailSlice from './Slices/EmailSlice';
import { useSelector } from 'react-redux';
const Store = configureStore({
  reducer: {
    headerSlice: HeaderSlice,
    // StickySlice,
    // TableSlice,
    // ChatReducer,
    // projectSlice,
    // EcommerceSlice,
    // filterSlice,
    themeSlice,
    // BookMarkSlice,
    // typeAheadSlice,
    // TaskSlice,
    // ToDoSlice,
    // BookMarkSliceHeader,
    // ContactReducer,
    // KnowledgeBaseSlice,
    // EmailSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default Store;

export type RootState = ReturnType<typeof Store.getState>;
export type AppDispatch = typeof Store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
