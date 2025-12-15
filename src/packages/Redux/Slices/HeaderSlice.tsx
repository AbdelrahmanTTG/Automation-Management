import ConfigDB from "@/packages/config/ThemeConfig";
import { createSlice } from "@reduxjs/toolkit";

const headerSlice = createSlice({
  name: "headerStates",
  initialState: {
    backGroundChange: "light-only",
    sideBarToggle: "",
    headerToggle:false,
    logoToggle:false,
  },
  reducers: {
    setBackGround: (state, action) => {
      state.backGroundChange = action.payload;
    },
    ToggleSideBarIn: () => {
      const sidebarClass = document.getElementById("page-main-header");
      const headerClass = document.getElementById("page-main-nav");
      const sidebar = sidebarClass?.classList.contains("close_icon");
      const header = headerClass?.classList.contains("close_icon");
      if (sidebar && header) {
        sidebarClass?.classList.remove("close_icon");
        headerClass?.classList.remove("close_icon");
      } else {
        sidebarClass?.classList.add("close_icon");
        headerClass?.classList.add("close_icon");
      }
    },
    setHeaderToggle: (state) => {
      state.headerToggle = !state.headerToggle;
    }, 
    setLogoToggle: (state) => {
      state.logoToggle = !state.logoToggle;
    },    
    handleLightTheme: (state) => {
      document.body.className = 'light-only'
      ConfigDB.data.color.mix_background_layout="light-only"
      state.logoToggle = false;
    },
    handleSidebarTheme: (state) => {
      document.body.className = "dark-sidebar"
      ConfigDB.data.color.mix_background_layout="dark-sidebar"
      state.logoToggle = true;
    },
    handleTheme: (state) => {
      document.body.className = "dark-only"
      ConfigDB.data.color.mix_background_layout="dark-only"
      state.logoToggle = true;
    },
  },
});

export default headerSlice.reducer;
export const { setBackGround, ToggleSideBarIn, setHeaderToggle, setLogoToggle,handleLightTheme, handleSidebarTheme, handleTheme } = headerSlice.actions;
