import React, { useContext, Fragment, useState, useEffect } from 'react';
import { Button, Input, ListGroup } from 'reactstrap';
import ConfigDB from '@/packages/config/ThemeConfig';
import { Apply, UnlimitedColor } from '@/packages/Constant';
import { useDispatch } from 'react-redux';
import { colorBackgroundAction1, colorBackgroundAction2 } from '@/packages/Redux/Slices/themeCostomizer';
import { useSelector } from 'react-redux';
import { RootState } from '@/packages/Redux/ReduxStore';

const ColorsComponent = () => {
  const { backgroundColor1, backgroundColor2 } = useSelector((store: RootState) => store.themeSlice);

  const dispatch = useDispatch();
  const addColor = (default_color: string, secondary_color: string) => {
    ConfigDB.data.color.primary_color = default_color;
    ConfigDB.data.color.secondary_color = secondary_color;
  };
  const default_color = backgroundColor1;
  const secondary_color = backgroundColor2;

  const [colorBackground1, setColorBackground1] = useState(default_color);
  const [colorBackground2, setColorBackground2] = useState(secondary_color);

  useEffect(() => {
    document.documentElement.style.setProperty('--theme-default', colorBackground1);
    document.documentElement.style.setProperty('--theme-secondary', colorBackground2);
    ConfigDB.data.color.primary_color = default_color;
    ConfigDB.data.color.secondary_color = secondary_color;
  }, [colorBackground1, colorBackground2]);

  const handleUnlimatedColor1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    dispatch(colorBackgroundAction1(value));
    setColorBackground1(value);
    ConfigDB.data.color.primary_color = value;
  };
  const handleUnlimatedColor2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    dispatch(colorBackgroundAction2(value));

    setColorBackground2(value);
    ConfigDB.data.color.secondary_color = value;
  };
  const OnUnlimatedColorClick = () => {
    addColor(colorBackground1, colorBackground2);
    document.documentElement.style.setProperty('--theme-default', colorBackground1);
    document.documentElement.style.setProperty('--theme-secondary', colorBackground2);
  };

  return (
    <Fragment>
      <h6>{UnlimitedColor}</h6>
      <ListGroup className=' flex-row layout-grid unlimited-color-layout'>
        <Input type='color' name='Color-Background1' value={colorBackground1} onChange={(e) => handleUnlimatedColor1Change(e)} />
        <Input type='color' name='Color-Background2' value={colorBackground2} onChange={(e) => handleUnlimatedColor2Change(e)} />
        <Button color='primary' className='color-apply-btn color-apply-btn' onClick={OnUnlimatedColorClick}>
          {Apply}
        </Button>
      </ListGroup>
    </Fragment>
  );
};

export default ColorsComponent;
