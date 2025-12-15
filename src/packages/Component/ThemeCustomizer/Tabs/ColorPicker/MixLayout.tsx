import { useAppDispatch } from "@/packages/Redux/ReduxStore";
import { handleLightTheme, handleSidebarTheme, handleTheme } from "@/packages/Redux/Slices/HeaderSlice";
import { Fragment } from "react";
import { ListGroup, ListGroupItem } from "reactstrap";
import { MixLayout } from "../../../../Constant";
import CommenUL from "../Sidebar/CommenUL";

const MixLayoutComponent = () => {
 const dispatch = useAppDispatch()

  return (
    <Fragment>
      <h6 className="">{MixLayout}</h6>
      <ListGroup className="layout-grid customizer-mix">
        <ListGroupItem className="color-layout active" dataattr="light-only" onClick={()=>dispatch(handleLightTheme())}>
          <div className="header bg-light">
            <CommenUL />
          </div>
          <div className="body">
            <ListGroup>
              <ListGroupItem className="bg-light sidebar"></ListGroupItem>
              <ListGroupItem className="bg-light body"> </ListGroupItem>
            </ListGroup>
          </div>
        </ListGroupItem>
          <ListGroupItem className="color-layout" dataattr="dark-sidebar"onClick={() => dispatch(handleSidebarTheme())}>
          <div className="header bg-light">
            <CommenUL />
          </div>
          <div className="body">
            <ListGroup>
              <ListGroupItem className="bg-dark sidebar"></ListGroupItem>
              <ListGroupItem className="bg-light body"> </ListGroupItem>
            </ListGroup>
          </div>
        </ListGroupItem>
        <ListGroupItem className="color-layout" onClick={() => dispatch(handleTheme())}>
          <div className="header bg-dark">
            <CommenUL />
          </div>
          <div className="body">
            <ListGroup>
              <ListGroupItem className="bg-dark sidebar"></ListGroupItem>
              <ListGroupItem className="bg-dark body"> </ListGroupItem>
            </ListGroup>
          </div>
        </ListGroupItem>
      </ListGroup>
    </Fragment>
  );
};

export default MixLayoutComponent;
