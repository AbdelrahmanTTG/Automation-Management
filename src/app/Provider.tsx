"use client";
import { Provider } from "react-redux";
import Store from "../packages/Redux/ReduxStore";
// import { PermissionProvider } from "../packages/contexts/PermissionContext";
const LayoutProvider = ({ children }: { children: React.ReactNode }) => {
  return (
     
      <Provider store={Store}>
      {/* <PermissionProvider> */}
        <div>{children}</div>
      {/* </PermissionProvider> */}
        
      </Provider>
    
  );
};

export default LayoutProvider;
