import ConfigDB from '@/packages/config/ThemeConfig';
import { createSlice } from '@reduxjs/toolkit';
const default_color = ConfigDB.data.color.primary_color;
const secondary_color = ConfigDB.data.color.secondary_color;

const themeSlice = createSlice({
  name: 'theme',
  initialState: {
    layoutType: '',
    sideBarType: 'compact-wrapper',
    backgroundColor1: default_color,
    backgroundColor2: secondary_color,
    animationTheme: '',
  },
  reducers: {
    handleLayoutType: (state, action) => {
      state.layoutType = action.payload;
    },
    handleSidebarType: (state, action: { payload: string }) => {
      state.sideBarType = action.payload;
    },
    colorBackgroundAction1: (state, action) => {
      state.backgroundColor1 = action.payload;
    },
    colorBackgroundAction2: (state, action) => {
      state.backgroundColor2 = action.payload;
    },
    handleAnimation: (state, action) => {
      state.animationTheme = action.payload;
    },
  },
});

export default themeSlice.reducer;
export const { handleAnimation, handleSidebarType, handleLayoutType, colorBackgroundAction1, colorBackgroundAction2 } = themeSlice.actions;
