// import { CommonMultipleSubHeadingProps } from "@/Type/SideBarType";
import React, { Fragment } from "react";
import { CardHeader } from "reactstrap";

const CommonMultipleSubHeading = ({ heading, subHeading }: CommonMultipleSubHeadingProps) => {
  return (
    <CardHeader className="pb-0">
      <h5>{heading}</h5>
       {subHeading && subHeading.map((span, i) => (
        <span key={i}>
          {span.spanData?.map((item, i) => (
            <Fragment key={i}>
              {item.text} {item.strong && <strong>{item.strong}</strong>} {item.code && <code>{item.code}</code>}
            </Fragment>
          ))}
        </span>
      ))}
    </CardHeader>
  );
};

export default CommonMultipleSubHeading;
