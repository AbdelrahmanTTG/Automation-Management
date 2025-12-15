import Context from "./index";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { ContactApi } from "../../api";

const ContactProvider = (props) => {
  const [users, setUsers] = useState([]);
  const [data, setData] = useState([]);

  const getUsers = async () => {
    try {
      await axios.get(`${ContactApi}`).then((resp) => {
        setUsers(resp.data);
      });
    } catch (error) {
      console.log("error", error);
    }
  };

  useEffect(() => {
    getUsers();
  }, [setUsers, setData]);

  const createUser = (data, imgUrl) => {
    const userTemp = {
      id: users.length + 1,
      avatar: imgUrl,
      name: data.name,
      surname: data.surname,
      email: data.email,
      age: data.age,
      mobile: data.mobile,
    };
    setUsers([...users, userTemp]);
    setData([...users, userTemp]);
  };

  const editUser = (data, imgUrl, id) => {
    const userTemp = {
      id: id,
      avatar: imgUrl,
      name: data.name,
      surname: data.surname,
      email: data.email,
      age: data.age,
      mobile: data.mobile,
    };

    setUsers((current) =>
      current.map((obj) => {
        if (obj.id === id) {
          return { ...obj, userTemp };
        }

        return obj;
      }),
    );
    setData((current) =>
      current.map((obj) => {
        if (obj.id === id) {
          return { ...obj, userTemp };
        }

        return obj;
      }),
    );
  };

  const deletedUser = (id) => {
    const val = users.findIndex((x) => x.id === id);
    if (val > -1) {
      users.splice(val, 1);
    }
    setData([...users]);
    setUsers([...users]);
  };

  return (
    <Context.Provider
      value={{
        ...props,
        users,
        data,
        setUsers: setUsers,
        createUser: createUser,
        editUser: editUser,
        deletedUser: deletedUser,
      }}>
      {props.children}
    </Context.Provider>
  );
};

export default ContactProvider;
