import { Javascript } from '@/Constant';
// import { CardHeaderCommonType } from '@/Type/SideBarType';
import React, { Fragment } from 'react';
import { CardHeader } from 'reactstrap';

const CardHeaderCommon = ({ icon, Name, title, description, description2 }: CardHeaderCommonType) => {
  return (
    <CardHeader className='p-4'>
      <h5>
        {icon && icon}
        {title}
      </h5>
      {description && (
        <span>
          {typeof description === 'string'
            ? description
            : description.map((item, index) => (
                <Fragment key={index}>
                  {item?.text}
                  {item.anchor && <a href={Javascript}>{item.anchor}</a>} {item.strong && <code>{item.strong}</code>}
                  {item.code && <code>{item.code}</code>}
                </Fragment>
              ))}
        </span>
      )}
      {description2 && (
        <span>
          {typeof description2 === 'string'
            ? description2
            : description2.map((item, index) => (
                <Fragment key={index}>
                  {item?.text} {item.code && <code>{item.code}</code>}
                </Fragment>
              ))}
        </span>
      )}
    </CardHeader>
  );
};

export default CardHeaderCommon;
